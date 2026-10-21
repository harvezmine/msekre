package expo.modules.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.WindowManager
import expo.modules.kotlin.Promise
import java.lang.ref.WeakReference

/**
 * Layar alarm boleh tampil di atas layar kunci dan menyalakan layar, HANYA saat aplikasi dibuka oleh alarm (intent
 * dengan [AlarmNotifier.EXTRA_ALARM]) dan selama alarm itu masih berbunyi. Izin itu dilepas lagi (a) saat alarm dimatikan
 * atau ditunda, (b) saat layar alarm ditutup, ditinggalkan, atau aplikasi ke latar, dan (c) saat activity berhenti
 * sementara tidak ada alarm yang berbunyi. Activity yang dibuat ulang (rotasi, proses dimatikan, dibuka dari Recents)
 * tidak pernah mendapatkannya, supaya aplikasi tidak bisa dipakai di atas layar kunci.
 */
object AlarmWindow {
  private var current: WeakReference<Activity>? = null

  fun track(activity: Activity?) {
    if (activity != null) current = WeakReference(activity)
  }

  fun activity(): Activity? = current?.get()

  fun untrack(activity: Activity?) {
    if (activity != null && current?.get() === activity) current = null
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
    activity.runOnUiThread { allow(activity, true) }
  }

  /** Lepas izin layar kunci. Dipanggil dari JS saat alarm dimatikan, ditunda, ditutup, atau aplikasi ke latar. */
  fun release() {
    val activity = activity() ?: return
    activity.runOnUiThread { allow(activity, false) }
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
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
      promise.resolve(true)
    }
  }

  private fun allow(activity: Activity, on: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(on)
      activity.setTurnScreenOn(on)
    } else {
      @Suppress("DEPRECATION")
      val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      if (on) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
    }
    if (on) {
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    } else {
      @Suppress("DEPRECATION")
      activity.window.clearFlags(
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
      )
    }
  }
}
