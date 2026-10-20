package expo.modules.alarm

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat

/** Keadaan izin yang menentukan apakah alarm benar-benar bunyi tepat waktu, dan pintasan ke pengaturannya. */
object AlarmStatus {
  private fun grant(ok: Boolean) = if (ok) "granted" else "denied"

  fun read(context: Context): Map<String, Any> {
    val manager = context.getSystemService(NotificationManager::class.java)
    val fullScreen = Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || manager?.canUseFullScreenIntent() != false
    var notifications = NotificationManagerCompat.from(context).areNotificationsEnabled()
    if (notifications && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Saluran alarm dimatikan sendiri oleh pengguna di pengaturan: tidak ada suara dan tampilan.
      val channel = manager?.getNotificationChannel(AlarmNotifier.CHANNEL_ID)
      if (channel != null && channel.importance == NotificationManager.IMPORTANCE_NONE) notifications = false
    }
    val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return mapOf(
      "exact" to grant(AlarmEngine.canScheduleExact(context)),
      "fullScreen" to grant(fullScreen),
      "notifications" to grant(notifications),
      "batteryOptimized" to !power.isIgnoringBatteryOptimizations(context.packageName),
    )
  }

  /**
   * Buka layar pengaturan untuk `kind` (`exact`, `fullScreen`, `notifications`, `battery`); kalau layarnya tidak ada di
   * HP ini, buka pengaturan aplikasi. `false` kalau tidak ada yang bisa dibuka.
   */
  fun open(context: Context, activity: Activity?, kind: String): Boolean {
    val pkg = context.packageName
    val uri = Uri.parse("package:$pkg")
    val specific = mutableListOf<Intent>()
    when (kind) {
      "exact" ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          specific += Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, uri)
        }
      "fullScreen" ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          specific += Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, uri)
        }
      "notifications" ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          specific += Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
        }
      // Daftar aplikasi hemat baterai: tidak butuh izin REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (dibatasi Google Play).
      "battery" -> specific += Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
    }
    val candidates = specific + Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri)
    for (intent in candidates) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        (activity ?: context).startActivity(intent)
        return true
      } catch (e: Exception) {
        // Layar ini tidak ada di HP ini: coba berikutnya.
      }
    }
    return false
  }
}
