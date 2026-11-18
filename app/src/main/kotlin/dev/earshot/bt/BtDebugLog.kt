package dev.earshot.bt

import dev.earshot.protocol.toHex
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong

/**
 * Live in-memory Bluetooth trace shown in the collapsible debug panel on the Home screen.
 * Keeps raw UUIDs, GATT discovery results, connection strategy steps, and raw BMAP TX/RX hex
 * responses completely separate from [LogRing] (so crash/support reports stay redacted).
 */
object BtDebugLog {
    const val CAPACITY = 300

    enum class Kind { LINK, UUID, GATT, TX, RX, ERR }

    data class Entry(
        val id: Long,
        val timestampMs: Long,
        val kind: Kind,
        val message: String,
        val detail: String? = null,
    )

    private val seq = AtomicLong(0L)
    private val lock = Any()
    private val buffer = ArrayDeque<Entry>(CAPACITY)
    private val _entries = MutableStateFlow<List<Entry>>(emptyList())
    val entries: StateFlow<List<Entry>> = _entries.asStateFlow()

    fun log(kind: Kind, message: String, detail: String? = null) {
        val entry = Entry(
            id = seq.incrementAndGet(),
            timestampMs = System.currentTimeMillis(),
            kind = kind,
            message = message,
            detail = detail,
        )
        val snapshot = synchronized(lock) {
            if (buffer.size >= CAPACITY) buffer.removeFirst()
            buffer.addLast(entry)
            buffer.toList()
        }
        _entries.value = snapshot
    }

    fun tx(label: String, bytes: ByteArray) =
        log(Kind.TX, "TX $label (${bytes.size}B)", bytes.toHex())

    fun rx(label: String, bytes: ByteArray) =
        log(Kind.RX, "RX $label (${bytes.size}B)", bytes.toHex())

    fun clear() {
        synchronized(lock) { buffer.clear() }
        _entries.value = emptyList()
    }

    fun formatAll(list: List<Entry> = _entries.value): String {
        val fmt = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
        return list.joinToString("\n") { e ->
            val time = fmt.format(Date(e.timestampMs))
            val suffix = e.detail?.let { " | $it" }.orEmpty()
            "$time [${e.kind.name}] ${e.message}$suffix"
        }
    }
}
