package expo.modules.alarm

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Mengikuti activity utama: dibuka langsung oleh alarm berarti boleh tampil di atas layar kunci selama alarm berbunyi.
 * Activity yang dibuat ulang atau dibuka dari Recents tidak pernah mendapatkan izin itu.
 */
class AlarmActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    AlarmWindow.track(activity)
    val flags = activity?.intent?.flags ?: 0
    val fromHistory = (flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0
    if (savedInstanceState != null || fromHistory) {
      AlarmWindow.forgetAlarmLink(activity)
      return
    }
    AlarmWindow.applyIfAlarm(activity, activity?.intent)
  }

  override fun onResume(activity: Activity?) {
    AlarmWindow.track(activity)
  }

  override fun onPause(activity: Activity?) {
    AlarmWindow.releaseIfIdle(activity)
  }

  override fun onUserLeaveHint(activity: Activity?) {
    AlarmWindow.releaseIfIdle(activity)
  }

  override fun onDestroy(activity: Activity?) {
    AlarmWindow.untrack(activity)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    AlarmWindow.applyIfAlarm(AlarmWindow.activity(), intent)
    return false
  }
}
