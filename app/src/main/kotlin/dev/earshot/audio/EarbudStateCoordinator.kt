package dev.earshot.audio

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dev.earshot.core.AudioTuningRepository
import dev.earshot.core.FormFactor
import dev.earshot.core.HeadphoneEvent
import dev.earshot.core.HeadphoneRepository
import dev.earshot.core.HeadphoneState
import dev.earshot.core.NoiseSettings
import dev.earshot.core.SpatialAudio
import dev.earshot.dsp.TuningSettings
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.IOException

private val Context.earbudStateDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "earbud_state",
    corruptionHandler = ReplaceFileCorruptionHandler { emptyPreferences() },
)

@Serializable
internal data class NoiseSnapshot(
    val cancellingLevel: Int = 10,
    val ancEnabled: Boolean = true,
    val spatialAudio: SpatialAudio = SpatialAudio.OFF,
) {
    fun toNoiseSettings(windBlock: Boolean = false): NoiseSettings = NoiseSettings(
        cancellingLevel = cancellingLevel,
        ancEnabled = ancEnabled,
        windBlock = windBlock,
        spatialAudio = spatialAudio,
    )
}

internal fun NoiseSettings.toSnapshot(): NoiseSnapshot = NoiseSnapshot(
    cancellingLevel = cancellingLevel,
    ancEnabled = ancEnabled,
    spatialAudio = spatialAudio,
)

@Serializable
internal data class PersistedEarbudState(
    val btd700ModeActive: Boolean = false,
    val activeSenseEnabled: Boolean? = null,
    val lastModeIndex: Int? = null,
    val lastNoise: NoiseSnapshot? = null,
    val lastTuning: TuningSettings? = null,
)

/**
 * Coordinates persistent state, BTD 700 Mode, Bose ActiveSense policy, and automatic reconnect
 * restoration for the Bose QuietComfort Ultra Earbuds (2nd Gen):
 *
 * 1. Persists custom Pro EQ slider settings, active band mode, AutoEq preset, Volume Boost,
 *    BTD 700 Mode, ActiveSense state, and last-used listening / Immersive Audio mode in DataStore.
 * 2. Enforces BTD 700 Mode: engaging it activates the USB-C aptX Lossless DSP audio path, locks
 *    Noise Cancelling to 10 (Quiet), and forces ActiveSense OFF.
 * 3. Defaults ActiveSense to OFF whenever Quiet mode or BTD 700 Mode is selected, while still
 *    letting the user toggle ActiveSense manually via `[1.29] AutoAwareMode`.
 * 4. Automatically re-applies persisted settings whenever the earbuds reconnect.
 */
class EarbudStateCoordinator internal constructor(
    private val store: DataStore<Preferences>,
    private val headphones: HeadphoneRepository,
    private val tuning: AudioTuningRepository,
    private val scope: CoroutineScope,
) {
    constructor(
        context: Context,
        headphones: HeadphoneRepository,
        tuning: AudioTuningRepository,
        scope: CoroutineScope,
    ) : this(context.applicationContext.earbudStateDataStore, headphones, tuning, scope)

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val mutex = Mutex()
    private val loaded = CompletableDeferred<Unit>()

    @Volatile
    private var started = false

    @Volatile
    private var restoring = false

    @Volatile
    private var state = PersistedEarbudState()

    private val _btd700ModeActive = MutableStateFlow(false)
    val btd700ModeActive: StateFlow<Boolean> = _btd700ModeActive.asStateFlow()

    fun start() {
        if (started) return
        started = true
        scope.launch {
            try {
                mutex.withLock { loadLocked() }
            } catch (t: Throwable) {
                logW("could not load earbud state: ${t.message}")
            } finally {
                loaded.complete(Unit)
            }
        }

        // Persist Pro EQ slider, band mode, preset, & Volume Boost updates whenever changed.
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            (tuning as? TuningRestore)?.awaitRestored()
            loaded.await()
            tuning.state
                .map { it.settings }
                .distinctUntilChanged()
                .drop(1)
                .collect { settings ->
                    if (restoring) return@collect
                    mutex.withLock {
                        updateStateLocked { it.copy(lastTuning = settings) }
                    }
                }
        }

        // Re-apply saved state whenever 2nd Gen earbuds connect (subscribed synchronously via UNDISPATCHED).
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            headphones.events.collect { event ->
                if (event == HeadphoneEvent.Connected) {
                    restoreOnReconnect()
                }
            }
        }
    }

    suspend fun awaitLoaded() = loaded.await()

    /**
     * Records a user-initiated listening mode selection (Quiet / Aware / Immersion / Cinema / custom).
     * Switching to Quiet defaults ActiveSense to OFF; switching away from Quiet unlocks BTD 700 Mode
     * if it was locking the slider, while persisting the new mode.
     */
    suspend fun recordModeSelection(index: Int) {
        loaded.await()
        val hp = headphones.state.value
        val quietSlot = findQuietSlotIndex(hp)
        val isQuiet = quietSlot != null && index == quietSlot
        mutex.withLock {
            val modeNoise = hp.modes.firstOrNull { m -> m.index == index }?.settings?.toSnapshot()
            val unlockBtd = !isQuiet && state.btd700ModeActive
            updateStateLocked {
                it.copy(
                    btd700ModeActive = if (unlockBtd) false else it.btd700ModeActive,
                    activeSenseEnabled = if (isQuiet) false else it.activeSenseEnabled,
                    lastModeIndex = index,
                    lastNoise = modeNoise ?: it.lastNoise,
                )
            }
            if (unlockBtd) _btd700ModeActive.value = false
        }
        if (isQuiet && hp.isConnected && hp.capabilities.activeSense) {
            runCatching { headphones.setActiveSense(false) }
        }
    }

    /**
     * Records a user-initiated noise / Bose Immersive Audio change (Off / Still / Motion or ANC level).
     */
    suspend fun recordNoiseChange(settings: NoiseSettings) {
        loaded.await()
        val coerced = mutex.withLock {
            val snap = if (state.btd700ModeActive) {
                NoiseSnapshot(cancellingLevel = MAX_ANC_LEVEL, ancEnabled = true, spatialAudio = settings.spatialAudio)
            } else {
                settings.toSnapshot()
            }
            updateStateLocked { it.copy(lastNoise = snap) }
            snap
        }
        if (state.btd700ModeActive && (settings.cancellingLevel < MAX_ANC_LEVEL || !settings.ancEnabled)) {
            val hp = headphones.state.value
            if (hp.isConnected) {
                runCatching { headphones.setNoise(coerced.toNoiseSettings(windBlock = false)) }
            }
        }
    }

    /**
     * Direct ActiveSense toggle via Bose BMAP `[1.29] AutoAwareMode`, persisted across reconnects.
     */
    suspend fun setActiveSenseEnabled(enabled: Boolean) {
        loaded.await()
        val lockedByBtd = mutex.withLock { state.btd700ModeActive }
        val target = if (lockedByBtd) false else enabled
        mutex.withLock {
            updateStateLocked { it.copy(activeSenseEnabled = target) }
        }
        val hp = headphones.state.value
        if (hp.isConnected && hp.capabilities.activeSense) {
            runCatching { headphones.setActiveSense(target) }
        }
    }

    /**
     * Engages or releases BTD 700 Mode:
     * - ON: unlocks USB-C aptX Lossless Pro EQ & Boost path, locks NC slider to 10 (Quiet), forces ActiveSense OFF.
     * - OFF: releases BTD 700 USB DSP override and unlocks the Noise Cancelling slider.
     */
    suspend fun setBtd700ModeEnabled(enabled: Boolean) {
        loaded.await()
        (tuning as? TuningRestore)?.awaitRestored()
        if (enabled) enableBtd700Mode() else disableBtd700Mode()
    }

    private suspend fun enableBtd700Mode() {
        val hpSnapshot = headphones.state.value
        val spatialForQuiet = mutex.withLock {
            val curNoise = (hpSnapshot.noise ?: state.lastNoise?.toNoiseSettings())?.toSnapshot()
            val spatial = curNoise?.spatialAudio ?: SpatialAudio.OFF
            val quietNoise = NoiseSnapshot(cancellingLevel = MAX_ANC_LEVEL, ancEnabled = true, spatialAudio = spatial)
            val quietSlot = findQuietSlotIndex(hpSnapshot)
            updateStateLocked {
                it.copy(
                    btd700ModeActive = true,
                    activeSenseEnabled = false,
                    lastModeIndex = quietSlot ?: it.lastModeIndex,
                    lastNoise = quietNoise,
                )
            }
            _btd700ModeActive.value = true
            spatial
        }

        // Enable phone-side Pro EQ DSP so Sennheiser BTD 700 lossless audio is tuned immediately.
        if (!tuning.state.value.settings.enabled) {
            tuning.setEnabled(true)
        }

        if (hpSnapshot.isConnected) {
            val quietSlot = findQuietSlotIndex(hpSnapshot)
            if (quietSlot != null && hpSnapshot.currentModeIndex != quietSlot) {
                runCatching { headphones.setMode(quietSlot) }
            }
            val latest = headphones.state.value
            val latestNoise = latest.noise
            if (latestNoise == null || !latestNoise.ancEnabled || latestNoise.cancellingLevel < MAX_ANC_LEVEL || latestNoise.windBlock) {
                runCatching {
                    headphones.setNoise(
                        NoiseSettings(
                            cancellingLevel = MAX_ANC_LEVEL,
                            ancEnabled = true,
                            windBlock = false,
                            spatialAudio = spatialForQuiet,
                        ),
                    )
                }
            }
            if (latest.capabilities.activeSense && latest.activeSenseEnabled != false) {
                runCatching { headphones.setActiveSense(false) }
            }
        }
    }

    private suspend fun disableBtd700Mode() {
        mutex.withLock {
            updateStateLocked { it.copy(btd700ModeActive = false) }
            _btd700ModeActive.value = false
        }
    }

    /**
     * Re-applies persisted Pro EQ sliders, band mode, AutoEq preset, boost level, BTD 700 Mode,
     * ActiveSense state, and listening/immersive mode when 2nd Gen earbuds connect.
     */
    suspend fun restoreOnReconnect() {
        loaded.await()
        (tuning as? TuningRestore)?.awaitRestored()
        val hp = headphones.state.value
        if (!hp.isConnected || !isEarbudTarget(hp)) return

        val snap = mutex.withLock { state }
        restoring = true
        try {
            val savedTuning = snap.lastTuning
            if (savedTuning != null && savedTuning != tuning.state.value.settings) {
                tuning.restoreSettings(savedTuning)
            }
            if (snap.btd700ModeActive) {
                val quietSlot = findQuietSlotIndex(hp)
                if (quietSlot != null && headphones.state.value.currentModeIndex != quietSlot) {
                    runCatching { headphones.setMode(quietSlot) }
                }
                val targetSpatial = snap.lastNoise?.spatialAudio ?: SpatialAudio.OFF
                val quietNoise = NoiseSettings(
                    cancellingLevel = MAX_ANC_LEVEL,
                    ancEnabled = true,
                    windBlock = false,
                    spatialAudio = targetSpatial,
                )
                if (headphones.state.value.noise != quietNoise) {
                    runCatching { headphones.setNoise(quietNoise) }
                }
                if (hp.capabilities.activeSense) {
                    runCatching { headphones.setActiveSense(false) }
                }
            } else {
                val modeIndex = snap.lastModeIndex?.takeIf { idx -> hp.modes.any { it.index == idx && it.isConfigured } }
                if (modeIndex != null && headphones.state.value.currentModeIndex != modeIndex) {
                    runCatching { headphones.setMode(modeIndex) }
                }
                val noise = snap.lastNoise?.toNoiseSettings(windBlock = false)
                if (noise != null && headphones.state.value.noise != noise) {
                    runCatching { headphones.setNoise(noise) }
                }
                if (hp.capabilities.activeSense) {
                    val quietSlot = findQuietSlotIndex(hp)
                    val targetActiveSense = if (modeIndex != null && modeIndex == quietSlot) false else snap.activeSenseEnabled
                    if (targetActiveSense != null && headphones.state.value.activeSenseEnabled != targetActiveSense) {
                        runCatching { headphones.setActiveSense(targetActiveSense) }
                    }
                }
            }
        } finally {
            restoring = false
        }
    }

    private fun isEarbudTarget(hp: HeadphoneState): Boolean =
        hp.capabilities.formFactor == FormFactor.EARBUDS ||
            hp.info?.productId == QC_ULTRA_EARBUDS_PRODUCT_ID ||
            hp.connection.deviceName?.contains("Earbud", ignoreCase = true) == true

    private fun findQuietSlotIndex(hp: HeadphoneState): Int? =
        hp.modes.firstOrNull { it.isConfigured && it.name.equals("Quiet", ignoreCase = true) }?.index
            ?: hp.modes.firstOrNull { it.isConfigured && it.index == 0 }?.index

    private suspend fun loadLocked() {
        val prefs = store.data
            .catch { e ->
                if (e is IOException) {
                    logW("earbud state unreadable, starting fresh: ${e.message}")
                    emit(emptyPreferences())
                } else {
                    throw e
                }
            }
            .first()
        val decoded = prefs[KEY_STATE]?.let { raw ->
            runCatching { json.decodeFromString<PersistedEarbudState>(raw) }.getOrNull()
        } ?: PersistedEarbudState()
        state = decoded
        _btd700ModeActive.value = decoded.btd700ModeActive
    }

    private suspend fun updateStateLocked(transform: (PersistedEarbudState) -> PersistedEarbudState) {
        val next = transform(state)
        if (next == state) return
        state = next
        persistLocked(next)
    }

    private suspend fun persistLocked(snapshot: PersistedEarbudState) {
        try {
            val encoded = json.encodeToString(snapshot)
            store.edit { prefs -> prefs[KEY_STATE] = encoded }
        } catch (e: IOException) {
            logW("could not persist earbud state: ${e.message}")
        }
    }

    private fun logW(msg: String) {
        runCatching { Log.w(TAG, msg) }
    }

    private companion object {
        const val TAG = "Earshot/EarbudState"
        const val MAX_ANC_LEVEL = 10
        const val QC_ULTRA_EARBUDS_PRODUCT_ID = 0x4062
        val KEY_STATE = stringPreferencesKey("earbud_state_json")
    }
}
