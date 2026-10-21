package expo.modules.alarm

import android.content.Context
import org.json.JSONObject

/**
 * Catatan alarm yang sedang berbunyi (id, judul, waktu, catatan). Layar alarm di aplikasi membacanya lewat
 * `getRinging(id)` kalau item agendanya tidak bisa dimuat (tanpa internet, sesi habis), jadi alarm yang berbunyi selalu
 * punya judul dan tombol Matikan. Catatan hilang sendiri setelah notifikasinya (lihat [AlarmNotifier.TIMEOUT_MS]),
 * dan saat alarm dimatikan atau ditunda.
 */
object RingingStore {
  private const val PREFS = "expo.modules.alarm.ringing"

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun put(context: Context, alarm: StoredAlarm, until: Long) {
    val json = JSONObject()
      .put("id", alarm.id)
      .put("at", alarm.at)
      .put("title", alarm.title)
      .put("note", alarm.note ?: JSONObject.NULL)
      .put("until", until)
    prefs(context).edit().putString(alarm.id, json.toString()).commit()
  }

  fun remove(context: Context, id: String) {
    prefs(context).edit().remove(id).commit()
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().commit()
  }

  /** Alarm yang masih berbunyi untuk id ini, atau `null` (tidak pernah berbunyi, sudah dimatikan, atau sudah lewat). */
  fun get(context: Context, id: String): StoredAlarm? {
    val raw = prefs(context).getString(id, null) ?: return null
    return parse(raw, System.currentTimeMillis())
  }

  /** Ada alarm yang masih berbunyi. Yang sudah kedaluwarsa dibuang sekalian. */
  fun hasActive(context: Context): Boolean {
    val now = System.currentTimeMillis()
    val store = prefs(context)
    var active = false
    for ((key, value) in store.all) {
      val alarm = (value as? String)?.let { parse(it, now) }
      if (alarm != null) active = true else store.edit().remove(key).commit()
    }
    return active
  }

  private fun parse(raw: String, now: Long): StoredAlarm? =
    try {
      val json = JSONObject(raw)
      if (json.getLong("until") <= now) {
        null
      } else {
        StoredAlarm(
          id = json.getString("id"),
          at = json.getLong("at"),
          title = json.getString("title"),
          note = if (json.isNull("note")) null else json.getString("note"),
        )
      }
    } catch (e: Exception) {
      null
    }
}
