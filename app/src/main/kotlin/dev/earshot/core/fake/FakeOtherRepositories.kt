package dev.earshot.core.fake

import dev.earshot.core.AppPreferences
import dev.earshot.core.AppSoundProfile
import dev.earshot.core.AudioOutputRoute
import dev.earshot.core.AudioTuningRepository
import dev.earshot.core.AutomationRepository
import dev.earshot.core.AutomationRule
import dev.earshot.core.CODEC_SWITCH_UNSUPPORTED_MESSAGE
import dev.earshot.core.CodecInfo
import dev.earshot.core.CodecOption
import dev.earshot.core.CodecRepository
import dev.earshot.core.CodecSelection
import dev.earshot.core.CodecState
import dev.earshot.core.ConnectionProfile
import dev.earshot.core.HeadphoneCommandException
import dev.earshot.core.MicCheckPhase
import dev.earshot.core.MicCheckRepository
import dev.earshot.core.MicCheckState
import dev.earshot.core.PrivilegeState
import dev.earshot.core.TuningState
import dev.earshot.dsp.BuiltInPresets
import dev.earshot.dsp.EqBandMode
import dev.earshot.dsp.EqPreset
import dev.earshot.dsp.ParametricBand
import dev.earshot.dsp.TuningSettings
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update

class FakeAudioTuningRepository : AudioTuningRepository {
    private val _presets = MutableStateFlow(BuiltInPresets.all)
    override val presets: StateFlow<List<EqPreset>> = _presets

    private val _state = MutableStateFlow(
        TuningState(
            outputRoute = AudioOutputRoute.BLUETOOTH_A2DP,
            isExternalOutputConnected = true,
        ),
    )
    override val state: StateFlow<TuningState> = _state

    private val _appProfiles = MutableStateFlow<List<AppSoundProfile>>(emptyList())
    override val appProfiles: StateFlow<List<AppSoundProfile>> = _appProfiles

    override suspend fun setEnabled(enabled: Boolean) =
        _state.update { it.copy(settings = it.settings.copy(enabled = enabled), attachedSessions = if (enabled) 1 else 0) }

    override suspend fun applyPreset(presetId: String?) {
        val preset = _presets.value.firstOrNull { it.id == presetId }
        _state.update {
            it.copy(
                activePreset = preset,
                settings = it.settings.copy(
                    activePresetId = preset?.id,
                    bands = preset?.bands ?: BuiltInPresets.flat.bands,
                    preampDb = preset?.preampDb ?: 0.0,
                ),
            )
        }
    }

    override suspend fun setBands(bands: List<ParametricBand>) =
        _state.update { it.copy(activePreset = null, settings = it.settings.copy(activePresetId = null, bands = bands)) }

    override suspend fun setBandMode(mode: EqBandMode) = _state.update { cur ->
        val s = cur.settings
        val saved = s.bandModeGains[mode]?.takeIf { it.size == mode.bandCount } ?: mode.sampleGainsFrom(s.bands)
        val updatedGains = s.bandModeGains + (mode to saved)
        cur.copy(
            activePreset = null,
            settings = s.copy(
                activePresetId = null,
                bandMode = mode,
                bandModeGains = updatedGains,
                bands = mode.bandsFromGains(saved),
            ),
        )
    }

    override suspend fun setBandModeGains(mode: EqBandMode, gainsDb: List<Double>) = _state.update { cur ->
        val s = cur.settings
        val clean = gainsDb.take(mode.bandCount).let { list ->
            if (list.size == mode.bandCount) list else List(mode.bandCount) { i -> list.getOrElse(i) { 0.0 } }
        }
        cur.copy(
            activePreset = null,
            settings = s.copy(
                activePresetId = null,
                bandMode = mode,
                bandModeGains = s.bandModeGains + (mode to clean),
                bands = mode.bandsFromGains(clean),
            ),
        )
    }

    override suspend fun setPreamp(db: Double) = _state.update { it.copy(settings = it.settings.copy(preampDb = db)) }
    override suspend fun setBoost(db: Double) = _state.update { it.copy(settings = it.settings.copy(boostDb = db)) }
    override suspend fun setLimiter(enabled: Boolean) = _state.update { it.copy(settings = it.settings.copy(limiterEnabled = enabled)) }
    override suspend fun restoreSettings(settings: TuningSettings) = _state.update {
        it.copy(
            activePreset = _presets.value.firstOrNull { p -> p.id == settings.activePresetId },
            settings = settings,
        )
    }
    override suspend fun setUseGlobalSession(enabled: Boolean) = _state.update { it.copy(useGlobalSession = enabled) }

    override suspend fun savePreset(preset: EqPreset) =
        _presets.update { list -> list.filterNot { it.id == preset.id } + preset }

    override suspend fun deletePreset(presetId: String) =
        _presets.update { list -> list.filterNot { it.id == presetId && !it.isBuiltIn } }

    override suspend fun setAppProfile(profile: AppSoundProfile) =
        _appProfiles.update { list -> list.filterNot { it.packageName == profile.packageName } + profile }

    override suspend fun removeAppProfile(packageName: String) =
        _appProfiles.update { list -> list.filterNot { it.packageName == packageName } }
}

/** @param canSwitch false mimics Shizuku not being ready (not running or not granted). */
class FakeCodecRepository(canSwitch: Boolean = true) : CodecRepository {
    private val _state = MutableStateFlow(
        CodecState(
            canSwitch = canSwitch,
            a2dpConnected = true,
            current = CodecInfo("AAC", 44100, 16, "Stereo"),
            options = listOf(
                CodecOption("SBC", listOf(44100, 48000), listOf(16), isSelectable = true),
                CodecOption("AAC", listOf(44100, 48000), listOf(16), isSelectable = true),
                CodecOption("aptX Adaptive", listOf(48000, 96000), listOf(24), listOf("High quality", "Low latency"), isSelectable = false),
            ),
            privilege = if (canSwitch) PrivilegeState.GRANTED else PrivilegeState.SHIZUKU_NOT_RUNNING,
        ),
    )
    override val state: StateFlow<CodecState> = _state

    override suspend fun refresh() { delay(100) }
    override suspend fun requestPrivilege() { _state.update { it.copy(privilege = PrivilegeState.GRANTED, canSwitch = true) } }

    override suspend fun selectCodec(selection: CodecSelection) {
        if (!_state.value.canSwitch) throw HeadphoneCommandException(CODEC_SWITCH_UNSUPPORTED_MESSAGE)
        if (_state.value.privilege != PrivilegeState.GRANTED) throw HeadphoneCommandException("Shizuku permission needed")
        delay(300)
        _state.update { it.copy(current = CodecInfo(selection.codecName, selection.sampleRateHz ?: 48000, selection.bitsPerSample ?: 16, "Stereo", selection.qualityMode)) }
    }

    override suspend fun applyProfile(profile: ConnectionProfile) = selectCodec(
        when (profile) {
            ConnectionProfile.BEST_QUALITY -> CodecSelection("AAC", 48000, 16)
            ConnectionProfile.MOST_STABLE -> CodecSelection("SBC", 44100, 16)
        },
    )

    override fun openDeveloperCodecSettings() = Unit
}

class FakeMicCheckRepository : MicCheckRepository {
    private val _state = MutableStateFlow(MicCheckState())
    override val state: StateFlow<MicCheckState> = _state

    override suspend fun record(maxSeconds: Int) {
        _state.value = MicCheckState(MicCheckPhase.RECORDING, usedHeadsetMic = true)
        repeat(maxSeconds * 10) { tick ->
            delay(100)
            _state.update { it.copy(recordedSeconds = tick / 10f, inputLevel = (0.2f + (tick % 7) * 0.1f)) }
        }
        _state.update { it.copy(phase = MicCheckPhase.READY, inputLevel = 0f) }
    }

    override suspend fun play() {
        val total = _state.value.recordedSeconds
        _state.update { it.copy(phase = MicCheckPhase.PLAYING) }
        var t = 0f
        while (t < total && _state.value.phase == MicCheckPhase.PLAYING) { delay(100); t += 0.1f; _state.update { it.copy(playbackPositionSeconds = t) } }
        _state.update { it.copy(phase = MicCheckPhase.READY, playbackPositionSeconds = 0f) }
    }

    override fun stop() { _state.update { it.copy(phase = if (it.recordedSeconds > 0) MicCheckPhase.READY else MicCheckPhase.IDLE) } }
    override fun discard() { _state.value = MicCheckState() }
}

class FakeAutomationRepository : AutomationRepository {
    private val _rules = MutableStateFlow<List<AutomationRule>>(emptyList())
    override val rules: StateFlow<List<AutomationRule>> = _rules
    private val _preferences = MutableStateFlow(AppPreferences())
    override val preferences: StateFlow<AppPreferences> = _preferences
    private val _log = MutableStateFlow(listOf("Connected: set Quiet (12:04)"))
    override val recentLog: StateFlow<List<String>> = _log

    override suspend fun upsertRule(rule: AutomationRule) = _rules.update { list -> list.filterNot { it.id == rule.id } + rule }
    override suspend fun deleteRule(id: String) = _rules.update { list -> list.filterNot { it.id == id } }
    override suspend fun setPreferences(preferences: AppPreferences) { _preferences.value = preferences }
    override suspend fun updateRules(transform: (List<AutomationRule>) -> List<AutomationRule>) = _rules.update(transform)
    override suspend fun updatePreferences(transform: (AppPreferences) -> AppPreferences) = _preferences.update(transform)
    override fun hasUsageAccess(): Boolean = false
    override fun openUsageAccessSettings() = Unit
}
