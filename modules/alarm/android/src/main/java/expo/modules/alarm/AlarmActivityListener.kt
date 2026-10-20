package expo.modules.alarm

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Mengikuti activity utama: dibuka oleh alarm berarti boleh tampil di atas layar kunci. */
class AlarmActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    AlarmWindow.track(activity)
    AlarmWindow.applyIfAlarm(activity, activity?.intent)
  }

  override fun onResume(activity: Activity?) {
    AlarmWindow.track(activity)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    AlarmWindow.applyIfAlarm(AlarmWindow.activity(), intent)
    return false
  }
}
