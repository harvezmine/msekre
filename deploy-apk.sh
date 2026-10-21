#!/usr/bin/env bash
# Bangun APK pratinjau Sekretaris AI di EAS, lalu terbitkan sebagai rilis terbaru di repo publik khusus rilis
# (harvezmine/sekretaris-apk). Kode tetap di repo msekre, yang boleh privat.
# Halaman secretary.my.id/apk selalu menunjuk ke rilis terbaru lewat link tetap, jadi landing tidak perlu diubah:
#   https://github.com/harvezmine/sekretaris-apk/releases/latest/download/sekretaris-ai.apk
#
# Pakai (dari folder mobile/):
#   ./deploy-apk.sh                  cek repo, tes, build, terbitkan
#   ./deploy-apk.sh --skip-tests     lewati tsc/lint/jest (mis. baru saja dijalankan)
#   ./deploy-apk.sh --notes "teks"   catatan rilis yang tampil di GitHub
#
# Butuh login Expo (`npx eas-cli@25 login`, atau `--device` lewat browser) dan GitHub CLI (`gh auth login`) dengan
# akses tulis ke repo. Nomor versi (versionCode) dinaikkan otomatis oleh EAS (eas.json: appVersionSource remote).
set -euo pipefail

REPO="harvezmine/sekretaris-apk"
ASSET="sekretaris-ai.apk"
PROFILE="preview"
EAS=(npx --yes eas-cli@25)
LATEST_URL="https://github.com/$REPO/releases/latest/download/$ASSET"

SKIP_TESTS=false
NOTES=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-tests) SKIP_TESTS=true ;;
    --notes)
      NOTES="${2:?--notes butuh teks}"
      shift
      ;;
    -h | --help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "Pilihan tidak dikenal: $1" >&2
      exit 2
      ;;
  esac
  shift
done

cd "$(dirname "$0")"
# shellcheck disable=SC1091
source ./dev-env.sh

log() { printf '\n== %s\n' "$*"; }
die() {
  printf '\nGAGAL: %s\n' "$*" >&2
  exit 1
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log "Memeriksa repo"
[[ -z "$(git status --porcelain)" ]] || die "ada perubahan yang belum di-commit. Commit dulu, lalu jalankan lagi."
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch -q origin "$BRANCH" || die "tidak bisa mengambil origin/$BRANCH"
[[ -z "$(git log "HEAD..origin/$BRANCH" --format=%H)" ]] || die "origin/$BRANCH punya commit yang belum ada di sini. Tarik dulu."
# Tanpa -q: grep membaca seluruh log, jadi `git log` tidak terhenti SIGPIPE dan pemeriksaan ini tidak terlewat.
if git log "origin/$BRANCH..HEAD" --format=%B |
  grep -iE 'co-authored-by:.*(claude|anthropic)|generated with \[?claude' >/dev/null; then
  die "ada commit dengan baris atribusi Claude. Perbaiki pesannya sebelum push."
fi
COMMIT="$(git rev-parse HEAD)"

log "Memeriksa login Expo dan GitHub"
"${EAS[@]}" whoami >/dev/null 2>&1 || die "belum login Expo. Jalankan: npx eas-cli@25 login"
gh auth status >/dev/null 2>&1 || die "belum login GitHub. Jalankan: gh auth login"

# Tes dulu, baru push: commit yang gagal tes tidak boleh sampai ke repo publik.
if [[ "$SKIP_TESTS" == false ]]; then
  log "TypeScript, lint, dan tes"
  npx tsc --noEmit
  npm run lint
  npx jest
  npx jest --clearCache >/dev/null
fi

if [[ -n "$(git log "origin/$BRANCH..HEAD" --format=%H)" ]]; then
  log "Push $BRANCH ke origin"
  git push -q origin "$BRANCH"
fi

log "Build APK ($PROFILE) di EAS, biasanya 10 sampai 25 menit"
"${EAS[@]}" build --platform android --profile "$PROFILE" --non-interactive --wait --json \
  --message "deploy-apk $(git rev-parse --short HEAD)" >"$WORK/build.json" ||
  die "build EAS gagal. Lihat lognya di expo.dev (proyek harvez)."

INFO="$(node -e '
const builds = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const b = Array.isArray(builds) ? builds[0] : builds;
const url = b && b.artifacts && (b.artifacts.applicationArchiveUrl || b.artifacts.buildUrl);
if (!b || b.status !== "FINISHED" || !url || !b.appVersion || !b.appBuildVersion || !b.id) {
  console.error(JSON.stringify((b && (b.error || b.status)) || "tanpa hasil"));
  process.exit(1);
}
console.log([url, b.appVersion, b.appBuildVersion, b.id].join(" "));
' "$WORK/build.json")" || die "build tidak selesai. Lihat lognya di expo.dev (proyek harvez)."
read -r APK_URL APP_VERSION BUILD_VERSION BUILD_ID <<<"$INFO"
[[ -n "$APK_URL" && -n "$APP_VERSION" && -n "$BUILD_VERSION" && -n "$BUILD_ID" ]] ||
  die "hasil build EAS tidak lengkap"

log "Mengunduh APK $APP_VERSION ($BUILD_VERSION)"
curl -fsSL --retry 3 -o "$WORK/$ASSET" "$APK_URL" || die "APK tidak bisa diunduh dari EAS"
[[ "$(head -c 2 "$WORK/$ASSET")" == "PK" ]] || die "file yang diunduh bukan APK"
SIZE="$(wc -c <"$WORK/$ASSET" | tr -d ' ')"
SHA="$(shasum -a 256 "$WORK/$ASSET" | cut -d' ' -f1)"
printf '%s  %s\n' "$SHA" "$ASSET" >"$WORK/$ASSET.sha256"

TAG="apk-v$APP_VERSION-$BUILD_VERSION"
log "Menerbitkan rilis $TAG di GitHub"
gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 && die "rilis $TAG sudah ada"
BODY="${NOTES:-Versi pratinjau aplikasi Android Sekretaris AI.}

Commit: $COMMIT
Build EAS: https://expo.dev/accounts/harvezzs-team/projects/harvez/builds/$BUILD_ID
SHA-256: $SHA"
gh release create "$TAG" "$WORK/$ASSET" "$WORK/$ASSET.sha256" --repo "$REPO" \
  --title "Sekretaris AI $APP_VERSION ($BUILD_VERSION)" --notes "$BODY" --latest >/dev/null

log "Memeriksa link unduhan terbaru"
LOCATION=""
for _ in 1 2 3 4 5 6; do
  LOCATION="$(curl -sI "$LATEST_URL" | awk 'tolower($1) == "location:" { print $2 }' | tr -d '\r' || true)"
  [[ "$LOCATION" == *"/download/$TAG/"* ]] && break
  sleep 5
done
# Rilisnya sudah terbit; GitHub kadang butuh beberapa saat sebelum link "latest" ikut berpindah.
[[ "$LOCATION" == *"/download/$TAG/"* ]] ||
  printf '\nPERINGATAN: link terbaru belum menunjuk ke %s (sekarang: %s). Cek lagi beberapa menit lagi.\n' \
    "$TAG" "${LOCATION:-kosong}" >&2

printf '\nSelesai.\n  Versi  : %s (%s)\n  Ukuran : %s MB\n  Unduh  : https://secretary.my.id/apk\n  Langsung: %s\n' \
  "$APP_VERSION" "$BUILD_VERSION" "$(awk -v s="$SIZE" 'BEGIN { printf "%.1f", s / 1048576 }')" "$LATEST_URL"
