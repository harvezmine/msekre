package expo.modules.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

/** Dipanggil AlarmManager saat alarm jatuh tempo: memasang notifikasi alarm (dengan intent layar penuh). */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != AlarmEngine.ACTION_FIRE) return
    val id = intent.getStringExtra(AlarmEngine.EXTRA_ID) ?: return
    // Sudah dibatalkan (tidak ada di penyimpanan): jangan berbunyi.
    val alarm = AlarmStore.get(context, id) ?: return
    // Menahan HP tetap terjaga sebentar sampai notifikasi terpasang.
    val wakeLock =
      try {
        (context.getSystemService(Context.POWER_SERVICE) as PowerManager)
          .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "expo.modules.alarm:fire")
          .apply { acquire(10_000L) }
      } catch (e: SecurityException) {
        null
      }
    try {
      AlarmStore.remove(context, id)
      AlarmNotifier.show(context, alarm)
    } finally {
      if (wakeLock?.isHeld == true) wakeLock.release()
    }
  }
}
