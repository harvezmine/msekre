package expo.modules.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * Penjadwalan lewat `AlarmManager.setAlarmClock`: alarm jam sungguhan, tetap berbunyi saat HP tidur atau dalam mode
 * hemat daya (Doze), dan tampil di ikon alarm bilah status. Butuh izin alarm tepat waktu di Android 12+.
 */
object AlarmEngine {
  const val ACTION_FIRE = "expo.modules.alarm.FIRE"
  const val EXTRA_ID = "expo.modules.alarm.ID"
  /** Alarm yang terlewat selama HP mati masih dibunyikan kalau terlambat tidak lebih dari ini. */
  private const val MISSED_MS = 15 * 60 * 1000L

  private fun manager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun canScheduleExact(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager(context).canScheduleExactAlarms()

  /** Intent pembunyi: dibedakan per id lewat data (extra tidak ikut menentukan identitas PendingIntent). */
  private fun firePendingIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.fromParts("alarm", id, null))
      .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /**
   * `true` kalau alarm terjadwal DAN akan terdengar. `false` kalau izin alarm tepat waktu belum diberikan, atau
   * notifikasi (atau saluran `alarm`) dimatikan: alarm yang tidak bisa berbunyi tidak boleh dikabarkan ke server, supaya
   * pengingat WhatsApp tetap jalan. Kalau hanya notifikasi yang mati, jadwalnya tetap dipasang (dan dipasang lagi tiap
   * sinkron), sehingga bunyi begitu notifikasi dinyalakan.
   */
  fun schedule(context: Context, alarm: StoredAlarm): Boolean {
    if (!canScheduleExact(context)) return false
    try {
      val info = AlarmManager.AlarmClockInfo(alarm.at, AlarmNotifier.agendaPendingIntent(context))
      manager(context).setAlarmClock(info, firePendingIntent(context, alarm.id))
      AlarmStore.put(context, alarm)
    } catch (e: SecurityException) {
      return false
    }
    AlarmNotifier.ensureChannel(context)
    return AlarmStatus.notificationsUsable(context)
  }

  fun cancel(context: Context, id: String) {
    val pending = firePendingIntent(context, id)
    manager(context).cancel(pending)
    pending.cancel()
    AlarmStore.remove(context, id)
    RingingStore.remove(context, id)
    AlarmNotifier.dismiss(context, id)
    AlarmNotifier.dismissMissed(context, id)
  }

  fun cancelAll(context: Context) {
    for (alarm in AlarmStore.all(context)) cancel(context, alarm.id)
    AlarmStore.clear(context)
    RingingStore.clear(context)
    AlarmNotifier.dismissAll(context)
  }

  /**
   * Pasang ulang jadwal dari penyimpanan (HP baru menyala, aplikasi diperbarui, jam diubah, izin alarm diberikan, modul
   * dimuat setelah aplikasi dihentikan paksa atau dimatikan penghemat baterai). Aman dipanggil berulang: jadwal berid
   * sama menggantikan yang lama (FLAG_UPDATE_CURRENT). Yang terlewat kurang dari 15 menit dibunyikan sekarang; yang
   * lebih lama tidak dibuang diam-diam, melainkan jadi notifikasi biasa "Pengingat terlewat".
   */
  fun restore(context: Context) {
    val now = System.currentTimeMillis()
    for (alarm in AlarmStore.all(context)) {
      when {
        alarm.at > now -> schedule(context, alarm)
        now - alarm.at <= MISSED_MS -> {
          AlarmStore.remove(context, alarm.id)
          AlarmNotifier.show(context, alarm)
        }
        else -> {
          AlarmStore.remove(context, alarm.id)
          AlarmNotifier.showMissed(context, alarm)
        }
      }
    }
  }
}
