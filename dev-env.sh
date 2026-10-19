# Lingkungan build repo ini, dipakai dengan: source dev-env.sh (dari folder mobile/).
# Node 24 lewat nvm (.nvmrc), JDK 17 dan Android SDK dari Homebrew. Tidak mengubah pengaturan global shell:
# JDK 21 dan Node bawaan tetap dipakai di luar repo ini.
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:/opt/homebrew/bin:$PATH"
# nvm terakhir, supaya Node 24 berada di depan node lain di PATH (Homebrew punya Node 26).
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh" >/dev/null
nvm use 24 >/dev/null
