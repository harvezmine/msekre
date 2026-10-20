package expo.modules.alarm

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Didaftarkan otomatis oleh autolinking Expo (nama berakhiran `Package` dan mengimpor `Package`). */
class AlarmPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> =
    listOf(AlarmActivityListener())
}
