package expo.modules.alarm

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.view.WindowManager
import java.lang.ref.WeakReference

/**
 * Layar alarm boleh tampil di atas layar kunci dan menyalakan layar, HANYA saat aplikasi dibuka oleh alarm (intent
 * dengan [AlarmNotifier.EXTRA_ALARM]). Dilepas lagi saat alarm dimatikan, supaya aplikasi biasa tidak ikut tampil di
 * atas layar kunci.
 */
object AlarmWindow {
  private var current: WeakReference<Activity>? = null

  fun track(activity: Activity?) {
    if (activity != null) current = WeakReference(activity)
  }

  fun activity(): Activity? = current?.get()

  fun applyIfAlarm(activity: Activity?, intent: Intent?) {
    if (activity == null || intent?.getBooleanExtra(AlarmNotifier.EXTRA_ALARM, false) != true) return
    activity.runOnUiThread { allow(activity, true) }
  }

  fun release() {
    val activity = activity() ?: return
    activity.runOnUiThread { allow(activity, false) }
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
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }
}
