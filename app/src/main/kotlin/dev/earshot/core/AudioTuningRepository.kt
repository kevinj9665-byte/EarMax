package dev.earshot.core

import dev.earshot.dsp.EqBandMode
import dev.earshot.dsp.EqPreset
import dev.earshot.dsp.ParametricBand
import dev.earshot.dsp.TuningSettings
import kotlinx.coroutines.flow.StateFlow

/** Detected external audio route driving Pro EQ & Volume Boost. */
enum class AudioOutputRoute {
    USB_AUDIO,
    BTD700_LOSSLESS,
    BLUETOOTH_A2DP,
    BOSE_CONTROL_LINK,
    PHONE_SPEAKER,
}

/** Runtime status of the on-phone sound engine (DynamicsProcessing + two-stage boost). */
data class TuningState(
    val settings: TuningSettings = TuningSettings(),
    val activePreset: EqPreset? = null,
    /** Audio sessions the engine is currently attached to (0 = nothing playing / not attached). */
    val attachedSessions: Int = 0,
    /** False when the device cannot create a DynamicsProcessing effect. */
    val isAvailable: Boolean = true,
    /** Package name of the app whose profile is active, if any. */
    val activeAppPackage: String? = null,
    /** Opt-in: also attach to the global output mix for players that never announce a session. */
    val useGlobalSession: Boolean = false,
    /** Active external or speaker output route detected by Android audio routing / Bose link / BTD 700 mode. */
    val outputRoute: AudioOutputRoute = AudioOutputRoute.PHONE_SPEAKER,
    val isExternalOutputConnected: Boolean = false,
    val warning: String? = null,
)

/** Mapping from an app to the preset it should get. */
data class AppSoundProfile(val packageName: String, val appLabel: String, val presetId: String)

interface AudioTuningRepository {
    val state: StateFlow<TuningState>
    val presets: StateFlow<List<EqPreset>>
    val appProfiles: StateFlow<List<AppSoundProfile>>

    suspend fun setEnabled(enabled: Boolean)
    /** Apply a saved preset (null = flat / custom). */
    suspend fun applyPreset(presetId: String?)
    /** Live edit; detaches from the named preset until saved. */
    suspend fun setBands(bands: List<ParametricBand>)
    /** Switch graphic Pro EQ between 3, 4, 5, and 7-band layouts, restoring its saved gains. */
    suspend fun setBandMode(mode: EqBandMode) {}
    /** Live update of the gains for [mode], persisting them per layout and syncing [TuningSettings.bands]. */
    suspend fun setBandModeGains(mode: EqBandMode, gainsDb: List<Double>) {}
    suspend fun setPreamp(db: Double)
    suspend fun setBoost(db: Double)
    suspend fun setLimiter(enabled: Boolean)
    /** Restores a full saved [TuningSettings] snapshot (sliders, preset, band mode, boost, limiter). */
    suspend fun restoreSettings(settings: TuningSettings) {}
    /** Deprecated Android path (session 0); refused on many Android 13+ phones, so it is opt-in. */
    suspend fun setUseGlobalSession(enabled: Boolean)

    suspend fun savePreset(preset: EqPreset)
    suspend fun deletePreset(presetId: String)

    suspend fun setAppProfile(profile: AppSoundProfile)
    suspend fun removeAppProfile(packageName: String)
}
