package expo.modules.alarm

import android.content.Context
import org.json.JSONObject

/** Satu alarm yang dijadwalkan: `at` dalam milidetik epoch. */
data class StoredAlarm(val id: String, val at: Long, val title: String, val note: String?)

/**
 * Penyimpanan alarm yang sedang dijadwalkan (SharedPreferences, satu entri per id). Dibaca saat HP dinyalakan ulang dan
 * saat jam berubah, karena AlarmManager melupakan semuanya. Disimpan sebagai JSON supaya tidak bergantung pada versi.
 */
object AlarmStore {
  private const val PREFS = "expo.modules.alarm.store"

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun put(context: Context, alarm: StoredAlarm) {
    val json = JSONObject()
      .put("id", alarm.id)
      .put("at", alarm.at)
      .put("title", alarm.title)
      .put("note", alarm.note ?: JSONObject.NULL)
    prefs(context).edit().putString(alarm.id, json.toString()).commit()
  }

  fun remove(context: Context, id: String) {
    prefs(context).edit().remove(id).commit()
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().commit()
  }

  fun get(context: Context, id: String): StoredAlarm? = prefs(context).getString(id, null)?.let(::parse)

  fun all(context: Context): List<StoredAlarm> =
    prefs(context).all.values.mapNotNull { (it as? String)?.let(::parse) }.sortedBy { it.at }

  private fun parse(raw: String): StoredAlarm? =
    try {
      val json = JSONObject(raw)
      StoredAlarm(
        id = json.getString("id"),
        at = json.getLong("at"),
        title = json.getString("title"),
        note = if (json.isNull("note")) null else json.getString("note"),
      )
    } catch (e: Exception) {
      null
    }
}
