package expo.modules.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Window
import android.view.WindowManager
import expo.modules.kotlin.Promise
import java.lang.ref.WeakReference

/**
 * Layar alarm boleh tampil di atas layar kunci dan menyalakan layar, HANYA saat aplikasi dibuka oleh alarm (intent
 * dengan [AlarmNotifier.EXTRA_ALARM]) dan selama alarm itu masih berbunyi. Izin itu dilepas lagi (a) saat alarm dimatikan
 * atau ditunda, (b) saat layar alarm ditutup atau ditinggalkan (aplikasi ke latar sendiri tidak melepasnya dari JS, lihat
 * `app/alarm.tsx`), (c) saat activity berhenti
 * sementara tidak ada alarm yang berbunyi, dan (d) setelah jendela bunyi alarm habis ([AlarmNotifier.TIMEOUT_MS]),
 * lewat pengaman di sini walau JS tidak sempat melepasnya. Penanda jendela hanya dilepas kalau modul ini yang
 * memasangnya (lihat [ownedFlags]): `FLAG_KEEP_SCREEN_ON` milik expo-keep-awake (mode suara) tidak ikut terhapus.
 * Activity yang dibuat ulang (rotasi, proses dimatikan, dibuka dari Recents)
 * tidak pernah mendapatkannya, supaya aplikasi tidak bisa dipakai di atas layar kunci.
 */
object AlarmWindow {
  /** Tambahan waktu pengaman setelah jendela bunyi alarm, supaya tidak mendahului JS dan notifikasi. */
  private const val SAFETY_SLACK_MS = 15_000L

  private var current: WeakReference<Activity>? = null

  /** Penanda jendela yang DIPASANG modul ini; hanya itu yang boleh dihapus lagi (bukan milik expo-keep-awake). */
  private var ownedFlags = 0

  private val handler = Handler(Looper.getMainLooper())
  private var safetyRelease: Runnable? = null

  fun track(activity: Activity?) {
    if (activity == null) return
    // Activity lain (dibuat ulang): penanda jendela lama tidak berlaku lagi.
    if (current?.get() !== activity) {
      ownedFlags = 0
      cancelSafetyRelease()
    }
    current = WeakReference(activity)
  }

  fun activity(): Activity? = current?.get()

  fun untrack(activity: Activity?) {
    if (activity != null && current?.get() === activity) {
      current = null
      ownedFlags = 0
      cancelSafetyRelease()
    }
  }

  /** Ekstra penanda dibuang setelah dibaca: membuka ulang intent yang sama tidak boleh memberi izin lagi. */
  private fun consume(intent: Intent?) {
    intent?.removeExtra(AlarmNotifier.EXTRA_ALARM)
  }

  /**
   * Activity dibuat ulang atau dibuka dari Recents: bukan dibuka oleh alarm. Penanda dibuang, dan tautan layar alarm
   * (`<skema>://alarm?id=`) dilepas dari intent supaya aplikasi tidak membuka layar alarm lagi dari Recents.
   */
  fun forgetAlarmLink(activity: Activity?) {
    val intent = activity?.intent ?: return
    consume(intent)
    if (intent.data?.host == "alarm") {
      intent.data = null
      intent.action = Intent.ACTION_MAIN
    }
  }

  fun applyIfAlarm(activity: Activity?, intent: Intent?) {
    val fromAlarm = intent?.getBooleanExtra(AlarmNotifier.EXTRA_ALARM, false) == true
    consume(intent)
    if (activity == null || !fromAlarm) return
    consume(activity.intent)
    activity.runOnUiThread {
      allow(activity, true)
      scheduleSafetyRelease(activity)
    }
  }

  /**
   * Lepas izin layar kunci. Dipanggil dari JS (thread utama, lewat modul) saat alarm dimatikan, ditunda, ditutup, atau
   * habis waktunya. Selesai di thread utama sebelum kembali, supaya JS yang menunggunya baru pindah layar sesudah izin
   * benar-benar lepas (Beranda atau chat tidak sempat tampil di atas layar kunci).
   */
  fun release() {
    val activity = activity() ?: return
    if (Looper.myLooper() == Looper.getMainLooper()) allow(activity, false) else activity.runOnUiThread { allow(activity, false) }
  }

  /**
   * Pengaman: jendela bunyi alarm habis (notifikasi hilang sendiri setelah [AlarmNotifier.TIMEOUT_MS]) tetapi JS tidak
   * sempat melepas izin (proses JS macet atau layar alarm tidak pernah dibuka): lepas dari sini.
   */
  private fun scheduleSafetyRelease(activity: Activity) {
    cancelSafetyRelease()
    val ref = WeakReference(activity)
    val task = Runnable {
      safetyRelease = null
      ref.get()?.let { allow(it, false) }
    }
    safetyRelease = task
    handler.postDelayed(task, AlarmNotifier.TIMEOUT_MS + SAFETY_SLACK_MS)
  }

  private fun cancelSafetyRelease() {
    safetyRelease?.let { handler.removeCallbacks(it) }
    safetyRelease = null
  }

  /**
   * Jendela alarm habis dan HP masih terkunci: layar alarm ditutup JS, lalu aplikasi dipindah ke latar supaya layar
   * kunci kembali (bukan Beranda di atas layar kunci). Tidak berbuat apa-apa kalau HP tidak terkunci.
   */
  fun moveToBackIfLocked(activity: Activity?): Boolean {
    val keyguard = activity?.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    if (activity == null || keyguard == null || !keyguard.isKeyguardLocked) return false
    return activity.moveTaskToBack(true)
  }

  /** Lepas izin layar kunci kalau tidak ada alarm yang sedang berbunyi (activity berhenti sementara). */
  fun releaseIfIdle(activity: Activity?) {
    if (activity == null || RingingStore.hasActive(activity.applicationContext)) return
    activity.runOnUiThread { allow(activity, false) }
  }

  /**
   * Minta pengguna membuka kunci HP (pola, PIN, atau sidik jari) tanpa meninggalkan aplikasi. Janji selesai `true` begitu
   * terbuka (atau HP memang tidak terkunci), ditolak kalau pengguna membatalkan. Dipanggil di thread utama.
   */
  fun dismissKeyguard(activity: Activity?, promise: Promise) {
    val keyguard = activity?.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    if (activity == null || keyguard == null || !keyguard.isKeyguardLocked) {
      promise.resolve(true)
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      keyguard.requestDismissKeyguard(
        activity,
        object : KeyguardManager.KeyguardDismissCallback() {
          override fun onDismissSucceeded() {
            promise.resolve(true)
          }

          override fun onDismissCancelled() {
            promise.reject("ERR_KEYGUARD_CANCELLED", "Pengguna tidak jadi membuka kunci HP", null)
          }

          override fun onDismissError() {
            promise.reject("ERR_KEYGUARD_ERROR", "HP tidak bisa membuka kunci dari sini", null)
          }
        },
      )
    } else {
      // Android 7: tidak ada panggilan balik; penanda ini meminta sistem membuka kunci yang tidak berpengaman.
      @Suppress("DEPRECATION")
      val dismiss = WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      addOwned(activity.window, dismiss)
      promise.resolve(true)
    }
  }

  /** Pasang penanda jendela hanya yang belum ada, dan catat bahwa modul inilah yang memasangnya. */
  @Suppress("DEPRECATION")
  private fun addOwned(window: Window, flags: Int) {
    for (bit in intArrayOf(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
      WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
    )) {
      if ((flags and bit) == 0) continue
      if ((window.attributes.flags and bit) == 0) {
        window.addFlags(bit)
        ownedFlags = ownedFlags or bit
      }
    }
  }

  /** Hapus hanya penanda yang dipasang modul ini; yang dipasang pihak lain (keep-awake) dibiarkan. */
  private fun clearOwned(window: Window, flags: Int) {
    val mine = ownedFlags and flags
    if (mine == 0) return
    window.clearFlags(mine)
    ownedFlags = ownedFlags and mine.inv()
  }

  @Suppress("DEPRECATION")
  private const val LEGACY_LOCK_FLAGS =
    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON

  @Suppress("DEPRECATION")
  private const val CLEAR_FLAGS =
    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD

  private fun allow(activity: Activity, on: Boolean) {
    val window = activity.window
    if (on) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(true)
        activity.setTurnScreenOn(true)
      } else {
        addOwned(window, LEGACY_LOCK_FLAGS)
      }
      addOwned(window, WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    } else {
      cancelSafetyRelease()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(false)
        activity.setTurnScreenOn(false)
      } else {
        clearOwned(window, LEGACY_LOCK_FLAGS)
      }
      clearOwned(window, CLEAR_FLAGS)
    }
  }
}
