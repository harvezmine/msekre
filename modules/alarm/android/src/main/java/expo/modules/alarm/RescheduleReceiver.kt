package expo.modules.alarm

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * HP menyala ulang, aplikasi diperbarui, jam atau zona waktu berubah, izin alarm tepat waktu berubah: pasang ulang.
 *
 * Receiver ini `exported` (broadcast sistem harus bisa sampai), dan `QUICKBOOT_POWERON` / `com.htc.intent.action.
 * QUICKBOOT_POWERON` bukan broadcast yang dilindungi sistem, jadi aplikasi lain bisa mengirimnya. Itu aman: `restore`
 * hanya memasang ulang jadwal yang sudah tersimpan (idempoten, FLAG_UPDATE_CURRENT) dan tidak membaca isi intent.
 */
class RescheduleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED,
      ACTION_QUICKBOOT,
      ACTION_QUICKBOOT_HTC -> AlarmEngine.restore(context)
    }
  }

  private companion object {
    const val ACTION_QUICKBOOT = "android.intent.action.QUICKBOOT_POWERON"
    const val ACTION_QUICKBOOT_HTC = "com.htc.intent.action.QUICKBOOT_POWERON"
  }
}
