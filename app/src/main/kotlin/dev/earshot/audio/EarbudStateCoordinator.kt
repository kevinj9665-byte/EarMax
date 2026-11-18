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
    val windBlockActive: Boolean = false,
    val preWindModeIndex: Int? = null,
    val preWindNoise: NoiseSnapshot? = null,
    val preWindTuning: TuningSettings? = null,
    val lastModeIndex: Int? = null,
    val lastNoise: NoiseSnapshot? = null,
    val lastTuning: TuningSettings? = null,
)

/**
 * Coordinates persistent state, Software Wind Block, and automatic reconnect restoration for the
 * Bose QuietComfort Ultra Earbuds (2nd Gen):
 *
 * 1. Persists custom Pro EQ slider settings, active AutoEq preset, Software Wind Block state, and
 *    last-used listening mode / Bose Immersive Audio preference (Off / Still / Motion) in DataStore.
 * 2. Implements Software Wind Block: engaging it snapshots the active listening mode, noise/spatial
 *    settings, and Pro EQ configuration; switches earbuds to Quiet (Max ANC); and engages the
 *    < 100 Hz Pro EQ wind-rumble cut. Toggling it off restores the exact previous mode & EQ curve.
 * 3. Automatically re-applies persisted settings whenever the earbuds reconnect.
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

    private val _windBlockActive = MutableStateFlow(false)
    val windBlockActive: StateFlow<Boolean> = _windBlockActive.asStateFlow()

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

        // Persist Pro EQ slider & preset updates whenever the user changes them.
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
                        if (state.windBlockActive && settings.windCutEnabled) {
                            // Keep underlying custom sliders/boost updates while Wind Block stays armed.
                            val updatedBase = settings.copy(windCutEnabled = false)
                            updateStateLocked {
                                it.copy(
                                    preWindTuning = updatedBase,
                                    lastTuning = settings,
                                )
                            }
                        } else if (!settings.windCutEnabled) {
                            updateStateLocked { it.copy(lastTuning = settings) }
                        }
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
     * If Software Wind Block was active and the user picks a different mode (e.g. Aware), Wind Block
     * disengages and restores the saved EQ curve while honoring the newly selected mode.
     */
    suspend fun recordModeSelection(index: Int) {
        loaded.await()
        var restoreEq: TuningSettings? = null
        mutex.withLock {
            val quietSlot = findQuietSlotIndex(headphones.state.value)
            val disengagingWind = state.windBlockActive && index != quietSlot
            if (disengagingWind) {
                restoreEq = state.preWindTuning ?: state.lastTuning?.copy(windCutEnabled = false)
                updateStateLocked {
                    it.copy(
                        windBlockActive = false,
                        preWindModeIndex = null,
                        preWindNoise = null,
                        preWindTuning = null,
                        lastModeIndex = index,
                        lastNoise = headphones.state.value.modes.firstOrNull { m -> m.index == index }?.settings?.toSnapshot()
                            ?: it.lastNoise,
                    )
                }
                _windBlockActive.value = false
            } else {
                val modeNoise = headphones.state.value.modes.firstOrNull { m -> m.index == index }?.settings?.toSnapshot()
                updateStateLocked {
                    it.copy(
                        lastModeIndex = index,
                        lastNoise = modeNoise ?: it.lastNoise,
                    )
                }
            }
        }
        restoreEq?.let { eq -> tuning.restoreSettings(eq.copy(windCutEnabled = false)) }
    }

    /**
     * Records a user-initiated noise / Bose Immersive Audio change (Off / Still / Motion or ANC level).
     */
    suspend fun recordNoiseChange(settings: NoiseSettings) {
        loaded.await()
        var restoreEq: TuningSettings? = null
        mutex.withLock {
            val snap = settings.toSnapshot()
            if (state.windBlockActive && (!settings.ancEnabled || settings.cancellingLevel < MAX_ANC_LEVEL)) {
                restoreEq = state.preWindTuning ?: state.lastTuning?.copy(windCutEnabled = false)
                updateStateLocked {
                    it.copy(
                        windBlockActive = false,
                        preWindModeIndex = null,
                        preWindNoise = null,
                        preWindTuning = null,
                        lastNoise = snap,
                    )
                }
                _windBlockActive.value = false
            } else if (state.windBlockActive) {
                // Keep spatial audio toggle synced into the restore snapshot if changed during Wind Block.
                updateStateLocked {
                    it.copy(
                        preWindNoise = (it.preWindNoise ?: snap).copy(spatialAudio = settings.spatialAudio),
                        lastNoise = snap,
                    )
                }
            } else {
                updateStateLocked { it.copy(lastNoise = snap) }
            }
        }
        restoreEq?.let { eq -> tuning.restoreSettings(eq.copy(windCutEnabled = false)) }
    }

    /**
     * Enables or disables Software Wind Block:
     * - ON: captures current listening mode, noise settings, and Pro EQ configuration; switches earbuds
     *   to Quiet (Max ANC); and engages the < 100 Hz Pro EQ wind-rumble cut.
     * - OFF: restores the previous listening mode, noise/spatial settings, and Pro EQ curve.
     */
    suspend fun setWindBlockEnabled(enabled: Boolean) {
        loaded.await()
        (tuning as? TuningRestore)?.awaitRestored()
        if (enabled) enableWindBlock() else disableWindBlock()
    }

    private suspend fun enableWindBlock() {
        val hpSnapshot = headphones.state.value
        val curTuning = tuning.state.value.settings
        val spatialForQuiet: SpatialAudio

        mutex.withLock {
            if (!state.windBlockActive) {
                val curMode = hpSnapshot.currentModeIndex ?: state.lastModeIndex
                val curNoise = (hpSnapshot.noise ?: state.lastNoise?.toNoiseSettings())?.toSnapshot()
                val baseTuning = if (curTuning.windCutEnabled) {
                    state.preWindTuning ?: curTuning.copy(windCutEnabled = false)
                } else {
                    curTuning
                }
                updateStateLocked {
                    it.copy(
                        windBlockActive = true,
                        preWindModeIndex = curMode,
                        preWindNoise = curNoise,
                        preWindTuning = baseTuning,
                    )
                }
                _windBlockActive.value = true
            }
            spatialForQuiet = state.preWindNoise?.spatialAudio ?: hpSnapshot.noise?.spatialAudio ?: SpatialAudio.OFF
        }

        // Engage < 100 Hz low-end wind-rumble cut via Pro EQ.
        tuning.setWindCut(true)

        // Switch earbuds to Quiet (Max ANC).
        if (hpSnapshot.isConnected) {
            val quietSlot = findQuietSlotIndex(hpSnapshot)
            if (quietSlot != null) {
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
        }
    }

    private suspend fun disableWindBlock() {
        var restoreMode: Int? = null
        var restoreNoise: NoiseSnapshot? = null
        var restoreTuning: TuningSettings? = null

        mutex.withLock {
            restoreMode = state.preWindModeIndex ?: state.lastModeIndex
            restoreNoise = state.preWindNoise ?: state.lastNoise
            restoreTuning = (state.preWindTuning ?: tuning.state.value.settings).copy(windCutEnabled = false)
            updateStateLocked {
                it.copy(
                    windBlockActive = false,
                    preWindModeIndex = null,
                    preWindNoise = null,
                    preWindTuning = null,
                    lastModeIndex = restoreMode ?: it.lastModeIndex,
                    lastNoise = restoreNoise ?: it.lastNoise,
                    lastTuning = restoreTuning,
                )
            }
            _windBlockActive.value = false
        }

        // Restore the user's custom Pro EQ sliders / AutoEq preset and remove < 100 Hz cut.
        restoreTuning?.let { tuning.restoreSettings(it) } ?: tuning.setWindCut(false)

        // Restore previous listening mode & noise/spatial settings if earbuds are connected.
        val hpState = headphones.state.value
        if (hpState.isConnected) {
            val modeToApply = restoreMode?.takeIf { idx -> hpState.modes.any { it.index == idx && it.isConfigured } }
            if (modeToApply != null) {
                runCatching { headphones.setMode(modeToApply) }
            }
            val noiseToApply = restoreNoise
            if (noiseToApply != null) {
                val target = noiseToApply.toNoiseSettings(windBlock = false)
                if (headphones.state.value.noise != target) {
                    runCatching { headphones.setNoise(target) }
                }
            }
        }
    }

    /**
     * Re-applies persisted Pro EQ sliders, active AutoEq preset, Wind Block state, and
     * listening/immersive mode when 2nd Gen earbuds connect.
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
            if (snap.windBlockActive) {
                val base = (snap.preWindTuning ?: savedTuning ?: tuning.state.value.settings).copy(windCutEnabled = true, enabled = true)
                tuning.restoreSettings(base)
                val quietSlot = findQuietSlotIndex(hp)
                if (quietSlot != null) {
                    runCatching { headphones.setMode(quietSlot) }
                }
                val targetSpatial = snap.preWindNoise?.spatialAudio ?: SpatialAudio.OFF
                val quietNoise = NoiseSettings(cancellingLevel = MAX_ANC_LEVEL, ancEnabled = true, windBlock = false, spatialAudio = targetSpatial)
                if (headphones.state.value.noise != quietNoise) {
                    runCatching { headphones.setNoise(quietNoise) }
                }
            } else {
                if (savedTuning != null && savedTuning != tuning.state.value.settings) {
                    tuning.restoreSettings(savedTuning)
                }
                val modeIndex = snap.lastModeIndex?.takeIf { idx -> hp.modes.any { it.index == idx && it.isConfigured } }
                if (modeIndex != null && headphones.state.value.currentModeIndex != modeIndex) {
                    runCatching { headphones.setMode(modeIndex) }
                }
                val noise = snap.lastNoise?.toNoiseSettings(windBlock = false)
                if (noise != null && headphones.state.value.noise != noise) {
                    runCatching { headphones.setNoise(noise) }
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
        _windBlockActive.value = decoded.windBlockActive
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
