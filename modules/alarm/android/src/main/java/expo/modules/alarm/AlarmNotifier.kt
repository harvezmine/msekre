package expo.modules.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * Notifikasi alarm: saluran `alarm` (suara alarm, getar, tampil di layar kunci), kategori ALARM, dan intent layar penuh
 * yang membuka aplikasi di `<skema>://alarm?id=<id>` (layar alarm di aplikasi).
 */
object AlarmNotifier {
  const val CHANNEL_ID = "alarm"
  /** Saluran notifikasi biasa untuk alarm yang terlewat (HP mati atau aplikasi dihentikan paksa saat waktunya). */
  const val CHANNEL_MISSED = "alarm_terlewat"
  /** Ekstra pada intent pembuka: aplikasi dibuka oleh alarm, jadi boleh tampil di atas layar kunci. */
  const val EXTRA_ALARM = "expo.modules.alarm.EXTRA_ALARM"
  private const val SCHEME_META = "expo.modules.alarm.DEEP_LINK_SCHEME"
  private const val DEFAULT_SCHEME = "sekretarisai"
  /** Notifikasi hilang sendiri kalau tidak disentuh (10 menit). */
  const val TIMEOUT_MS = 10 * 60 * 1000L
  private val VIBRATION = longArrayOf(0, 600, 400, 600, 400, 1200)

  fun notificationId(id: String): Int = id.hashCode()

  private fun missedNotificationId(id: String): Int = "terlewat:$id".hashCode()

  /** Skema tautan aplikasi, ditulis plugin dari `scheme` di app.config. */
  private fun scheme(context: Context): String =
    try {
      @Suppress("DEPRECATION")
      val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      info.metaData?.getString(SCHEME_META) ?: DEFAULT_SCHEME
    } catch (e: Exception) {
      DEFAULT_SCHEME
    }

  /**
   * Tautan layar alarm: `<skema>://alarm?id=<id>`. Tanpa judul di tautan (isinya bisa dibaca aplikasi lain dan tampil di
   * log): layar alarm membaca judul dari catatan alarm di HP (`getRinging`) kalau item agendanya tidak bisa dimuat.
   */
  fun launchIntent(context: Context, alarm: StoredAlarm): Intent =
    Intent(
      Intent.ACTION_VIEW,
      Uri.parse("${scheme(context)}://alarm?id=${Uri.encode(alarm.id)}"),
    ).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra(EXTRA_ALARM, true)
    }

  fun openAppPendingIntent(context: Context, alarm: StoredAlarm): PendingIntent =
    PendingIntent.getActivity(
      context,
      0,
      launchIntent(context, alarm),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /**
   * Membuka Agenda tanpa penanda alarm: untuk ikon alarm di bilah status dan notifikasi "terlewat". Tidak memberi izin
   * tampil di atas layar kunci (itu hanya untuk alarm yang sedang berbunyi, lihat [launchIntent]).
   */
  fun agendaPendingIntent(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("${scheme(context)}://agenda")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val channel = NotificationChannel(CHANNEL_ID, "Alarm pengingat", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Pengingat yang berbunyi seperti alarm, juga saat HP terkunci."
        setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), attributes)
        enableVibration(true)
        vibrationPattern = VIBRATION
        // Judul pengingat tidak tampil di layar kunci; yang tampil hanya "Pengingat" (lihat show).
        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      }
      manager.createNotificationChannel(channel)
    }
    if (manager.getNotificationChannel(CHANNEL_MISSED) == null) {
      val channel = NotificationChannel(CHANNEL_MISSED, "Pengingat terlewat", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Pengingat yang waktunya lewat saat HP mati atau aplikasi sedang berhenti."
        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      }
      manager.createNotificationChannel(channel)
    }
  }

  private fun smallIcon(context: Context): Int {
    // `notification_icon` dibuat plugin expo-notifications dari ikon di app.config; cadangannya ikon alarm sistem.
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else android.R.drawable.ic_lock_idle_alarm
  }

  /** Pasang notifikasi alarm sekarang, dan catat bahwa alarm ini sedang berbunyi (dibaca layar alarm lewat `getRinging`). */
  fun show(context: Context, alarm: StoredAlarm) {
    ensureChannel(context)
    RingingStore.put(context, alarm, System.currentTimeMillis() + TIMEOUT_MS)
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val open = openAppPendingIntent(context, alarm)
    // Layar kunci hanya menampilkan "Pengingat"; judul dan catatan baru terlihat setelah HP dibuka.
    val publicVersion = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle("Pengingat")
      .build()
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(alarm.title)
      .setContentText(alarm.note ?: "Pengingat")
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(publicVersion)
      .setOngoing(true)
      .setAutoCancel(true)
      .setShowWhen(true)
      .setWhen(alarm.at)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .setTimeoutAfter(TIMEOUT_MS)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      // Sebelum saluran notifikasi, suara dan getar diatur per notifikasi.
      builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), AudioManager.STREAM_ALARM)
      builder.setVibrate(VIBRATION)
    }
    val notification = builder.build()
    // Suara terus berulang sampai notifikasi disentuh atau dimatikan dari layar alarm.
    notification.flags = notification.flags or Notification.FLAG_INSISTENT
    manager.notify(notificationId(alarm.id), notification)
  }

  /**
   * Alarm yang waktunya lewat jauh sebelum sempat berbunyi (HP mati, aplikasi dihentikan paksa): notifikasi biasa, tanpa
   * layar penuh dan tanpa bunyi alarm, supaya tidak hilang diam-diam. Mengetuknya membuka Agenda.
   */
  fun showMissed(context: Context, alarm: StoredAlarm) {
    ensureChannel(context)
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val open = agendaPendingIntent(context)
    val publicVersion = NotificationCompat.Builder(context, CHANNEL_MISSED)
      .setSmallIcon(smallIcon(context))
      .setContentTitle("Pengingat terlewat")
      .build()
    val notification = NotificationCompat.Builder(context, CHANNEL_MISSED)
      .setSmallIcon(smallIcon(context))
      .setContentTitle("Pengingat terlewat: ${alarm.title}")
      .setContentText(alarm.note ?: "Waktunya sudah lewat saat HP tidak bisa membunyikannya.")
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(publicVersion)
      .setShowWhen(true)
      .setWhen(alarm.at)
      .setAutoCancel(true)
      .setContentIntent(open)
      .build()
    manager.notify(missedNotificationId(alarm.id), notification)
  }

  fun dismiss(context: Context, id: String) {
    context.getSystemService(NotificationManager::class.java)?.cancel(notificationId(id))
  }

  /** Buang notifikasi "Pengingat terlewat" untuk id ini (alarmnya dibatalkan atau diganti, jadi tidak relevan lagi). */
  fun dismissMissed(context: Context, id: String) {
    context.getSystemService(NotificationManager::class.java)?.cancel(missedNotificationId(id))
  }

  /** Buang semua notifikasi alarm yang sedang tampil. */
  fun dismissAll(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      manager.activeNotifications
        .filter { Build.VERSION.SDK_INT < Build.VERSION_CODES.O || it.notification.channelId == CHANNEL_ID || it.notification.channelId == CHANNEL_MISSED }
        .forEach { manager.cancel(it.id) }
    }
  }
}
