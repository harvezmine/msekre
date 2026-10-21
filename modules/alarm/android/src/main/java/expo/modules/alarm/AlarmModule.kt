package expo.modules.alarm

import android.content.Context
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Alarm lokal untuk JS (`modules/alarm/index.ts`). Waktu dalam milidetik epoch. Semua jadwal disimpan di
 * [AlarmStore] supaya bisa dipasang ulang setelah HP dinyalakan ulang atau aplikasi dihentikan paksa.
 */
class AlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun entry(alarm: StoredAlarm): Map<String, Any?> =
    mapOf("id" to alarm.id, "at" to alarm.at.toDouble(), "title" to alarm.title, "note" to alarm.note)

  override fun definition() = ModuleDefinition {
    Name("Alarm")

    OnCreate {
      appContext.reactContext?.let { ctx ->
        AlarmNotifier.ensureChannel(ctx)
        // Jadwal hilang kalau aplikasi dihentikan paksa atau dimatikan penghemat baterai: pasang ulang dari
        // penyimpanan setiap modul dimuat. Aman diulang (FLAG_UPDATE_CURRENT).
        try {
          AlarmEngine.restore(ctx)
        } catch (e: Exception) {
          // Pemasangan ulang gagal: sinkron agenda berikutnya memasang lagi semuanya.
        }
      }
    }

    // `true` kalau terjadwal dan akan terdengar; `false` kalau izin alarm tepat waktu belum diberikan atau notifikasi
    // (juga saluran alarm) dimatikan.
    AsyncFunction("schedule") { id: String, atMillis: Double, title: String, note: String? ->
      AlarmEngine.schedule(context, StoredAlarm(id, atMillis.toLong(), title, note))
    }

    AsyncFunction("cancel") { id: String ->
      AlarmEngine.cancel(context, id)
    }

    AsyncFunction("cancelAll") { ->
      AlarmEngine.cancelAll(context)
    }

    AsyncFunction("list") { ->
      AlarmStore.all(context).map { entry(it) }
    }

    // Alarm yang sedang berbunyi (atau terjadwal) untuk id ini, atau null. Layar alarm memakainya kalau item agendanya
    // tidak bisa dimuat.
    // `until` (milidetik epoch) = akhir jendela bunyi, ada hanya untuk alarm yang sedang berbunyi; layar alarm menutup
    // diri saat itu.
    AsyncFunction("getRinging") { id: String ->
      val ringing = RingingStore.get(context, id)
      if (ringing != null) {
        entry(ringing) + mapOf("until" to RingingStore.until(context, id)?.toDouble())
      } else {
        AlarmStore.get(context, id)?.let { entry(it) }
      }
    }

    Function("status") { ->
      AlarmStatus.read(context)
    }

    AsyncFunction("openSettings") { kind: String ->
      AlarmStatus.open(context, appContext.currentActivity, kind)
    }.runOnQueue(Queues.MAIN)

    // Alarm dimatikan, ditunda, ditutup, atau habis waktunya: aplikasi tidak lagi boleh tampil di atas layar kunci.
    // Jalan di thread utama dan selesai sesudah izinnya lepas, jadi JS yang menunggunya tidak mendahului jendela.
    AsyncFunction("releaseLockScreen") { ->
      AlarmWindow.release()
    }.runOnQueue(Queues.MAIN)

    // Jendela bunyi habis di HP terkunci: pindahkan aplikasi ke latar supaya layar kunci kembali. `false` kalau HP tidak
    // terkunci (tidak berbuat apa-apa).
    AsyncFunction("moveToBack") { ->
      AlarmWindow.moveToBackIfLocked(appContext.currentActivity)
    }.runOnQueue(Queues.MAIN)

    // Minta pengguna membuka kunci HP; selesai setelah terbuka, ditolak kalau dibatalkan.
    AsyncFunction("dismissKeyguard") { promise: Promise ->
      AlarmWindow.dismissKeyguard(appContext.currentActivity, promise)
    }.runOnQueue(Queues.MAIN)
  }
}
