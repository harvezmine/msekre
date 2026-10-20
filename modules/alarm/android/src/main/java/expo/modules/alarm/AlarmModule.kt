package expo.modules.alarm

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Alarm lokal untuk JS (`modules/alarm/index.ts`). Waktu dalam milidetik epoch. Semua jadwal disimpan di
 * [AlarmStore] supaya bisa dipasang ulang setelah HP dinyalakan ulang.
 */
class AlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("Alarm")

    OnCreate {
      appContext.reactContext?.let { AlarmNotifier.ensureChannel(it) }
    }

    // `true` kalau terjadwal; `false` kalau izin alarm tepat waktu belum diberikan.
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
      AlarmStore.all(context).map {
        mapOf("id" to it.id, "at" to it.at.toDouble(), "title" to it.title, "note" to it.note)
      }
    }

    Function("status") { ->
      AlarmStatus.read(context)
    }

    AsyncFunction("openSettings") { kind: String ->
      AlarmStatus.open(context, appContext.currentActivity, kind)
    }

    // Alarm dimatikan: aplikasi tidak lagi boleh tampil di atas layar kunci.
    AsyncFunction("releaseLockScreen") { ->
      AlarmWindow.release()
    }
  }
}
