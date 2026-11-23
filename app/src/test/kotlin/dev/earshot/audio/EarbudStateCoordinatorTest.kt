package dev.earshot.audio

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import dev.earshot.core.HeadphoneEvent
import dev.earshot.core.HeadphoneRepository
import dev.earshot.core.HeadphoneState
import dev.earshot.core.NoiseSettings
import dev.earshot.core.SpatialAudio
import dev.earshot.core.fake.FakeAudioTuningRepository
import dev.earshot.core.fake.FakeHeadphoneRepository
import dev.earshot.dsp.BuiltInPresets
import dev.earshot.dsp.EqBandMode
import dev.earshot.dsp.ParametricBand
import dev.earshot.dsp.TuningSettings
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EarbudStateCoordinatorTest {

    @get:Rule
    val folder = TemporaryFolder()

    private val storeScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val appScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    @After
    fun tearDown() {
        appScope.cancel()
        storeScope.cancel()
    }

    private fun storeFile(name: String = "earbud_state.preferences_pb", scope: CoroutineScope = storeScope): DataStore<Preferences> =
        PreferenceDataStoreFactory.create(scope = scope) { File(folder.root, name) }

    private class RecordingEarbuds(initial: HeadphoneState = FakeHeadphoneRepository.connectedEarbudsState()) :
        HeadphoneRepository by FakeHeadphoneRepository(commandDelayMillis = 0) {
        private val _state = MutableStateFlow(initial)
        override val state: StateFlow<HeadphoneState> = _state

        private val _events = MutableSharedFlow<HeadphoneEvent>(extraBufferCapacity = 16)
        override val events: SharedFlow<HeadphoneEvent> = _events

        val modeCalls = mutableListOf<Int>()
        val noiseCalls = mutableListOf<NoiseSettings>()
        val activeSenseCalls = mutableListOf<Boolean>()

        override suspend fun setMode(index: Int) {
            modeCalls += index
            _state.update { s ->
                val chosen = s.modes.firstOrNull { it.index == index }
                s.copy(currentModeIndex = index, noise = chosen?.settings ?: s.noise)
            }
        }

        override suspend fun setNoise(settings: NoiseSettings) {
            noiseCalls += settings
            _state.update { it.copy(noise = settings) }
        }

        override suspend fun setActiveSense(enabled: Boolean) {
            activeSenseCalls += enabled
            _state.update { it.copy(activeSenseEnabled = enabled) }
        }

        fun reconnectWith(newState: HeadphoneState) {
            _state.value = newState
            _events.tryEmit(HeadphoneEvent.Connected)
        }
    }

    private class GatedFakeTuning(
        val inner: FakeAudioTuningRepository = FakeAudioTuningRepository(),
    ) : dev.earshot.core.AudioTuningRepository by inner, TuningRestore {
        val restored = CompletableDeferred<Unit>().apply { complete(Unit) }
        override suspend fun awaitRestored() = restored.await()
    }

    private suspend fun waitUntil(predicate: suspend () -> Boolean) {
        withTimeout(5_000) {
            while (!predicate()) delay(10)
        }
    }

    @Test
    fun `btd700 mode defaults to Quiet ANC 10 and ActiveSense OFF while keeping NC slider and ActiveSense unlocked`() = runBlocking<Unit> {
        val hp = RecordingEarbuds()
        val tuning = GatedFakeTuning()
        val coordinator = EarbudStateCoordinator(storeFile(), hp, tuning, appScope).also { it.start() }
        coordinator.awaitLoaded()

        // User starts in Aware mode with ActiveSense manually ON.
        hp.setMode(1) // Aware
        coordinator.recordModeSelection(1)
        coordinator.setActiveSenseEnabled(true)
        assertTrue(hp.state.value.activeSenseEnabled == true)

        // Toggle BTD 700 Mode ON -> applies Quiet (NC 10) + ActiveSense OFF defaults and unlocks Pro EQ.
        coordinator.setBtd700ModeEnabled(true)
        assertTrue(coordinator.btd700ModeActive.value)
        assertTrue(tuning.state.value.settings.enabled, "Expected Pro EQ DSP unlocked & enabled")
        assertEquals(0, hp.state.value.currentModeIndex, "Expected Quiet mode (slot 0)")
        assertEquals(10, hp.state.value.noise?.cancellingLevel, "Expected initial ANC 10 (Quiet)")
        assertTrue(hp.state.value.noise?.ancEnabled == true)
        assertFalse(hp.state.value.activeSenseEnabled == true, "Expected initial ActiveSense OFF in BTD 700 Mode")

        // User freely customizes NC slider & Spatial Audio & ActiveSense while BTD 700 Mode stays active.
        val customNoise = NoiseSettings(cancellingLevel = 3, ancEnabled = true, spatialAudio = SpatialAudio.ROOM)
        hp.setNoise(customNoise)
        coordinator.recordNoiseChange(customNoise)
        assertEquals(3, hp.state.value.noise?.cancellingLevel)
        assertEquals(SpatialAudio.ROOM, hp.state.value.noise?.spatialAudio)
        assertTrue(coordinator.btd700ModeActive.value, "BTD 700 Mode must remain active after NC change")

        coordinator.setActiveSenseEnabled(true)
        assertEquals(true, hp.state.value.activeSenseEnabled, "ActiveSense must remain freely toggleable during BTD 700 Mode")
        assertTrue(coordinator.btd700ModeActive.value, "BTD 700 Mode must remain active after ActiveSense toggle")

        // Toggling ANC master off and custom level continues to work cleanly.
        val ancOff = NoiseSettings(cancellingLevel = 4, ancEnabled = false, spatialAudio = SpatialAudio.OFF)
        hp.setNoise(ancOff)
        coordinator.recordNoiseChange(ancOff)
        assertEquals(4, hp.state.value.noise?.cancellingLevel)
        assertEquals(false, hp.state.value.noise?.ancEnabled)
        assertTrue(coordinator.btd700ModeActive.value)
    }

    @Test
    fun `selecting Quiet mode defaults ActiveSense to OFF while keeping manual toggle in non-Quiet modes`() = runBlocking<Unit> {
        val hp = RecordingEarbuds()
        val tuning = GatedFakeTuning()
        val coordinator = EarbudStateCoordinator(storeFile(), hp, tuning, appScope).also { it.start() }
        coordinator.awaitLoaded()

        // Aware mode allows enabling ActiveSense manually.
        hp.setMode(1)
        coordinator.recordModeSelection(1)
        coordinator.setActiveSenseEnabled(true)
        assertEquals(true, hp.state.value.activeSenseEnabled)

        // Switching to Quiet (slot 0) automatically defaults ActiveSense OFF.
        hp.setMode(0)
        coordinator.recordModeSelection(0)
        assertEquals(false, hp.state.value.activeSenseEnabled)

        // Switching away to Aware still allows toggling ActiveSense back ON.
        hp.setMode(1)
        coordinator.recordModeSelection(1)
        coordinator.setActiveSenseEnabled(true)
        assertEquals(true, hp.state.value.activeSenseEnabled)
    }

    @Test
    fun `persisted AutoEq preset, band mode, per-mode gains, boost, and listening + spatial modes restore on reconnect`() = runBlocking<Unit> {
        val dbFile = "earbud_persist.preferences_pb"
        val storeScope1 = CoroutineScope(Dispatchers.IO + SupervisorJob())
        val scope1 = CoroutineScope(Dispatchers.Default + SupervisorJob())
        val hp1 = RecordingEarbuds()
        val tuning1 = GatedFakeTuning()
        val coord1 = EarbudStateCoordinator(storeFile(dbFile, storeScope1), hp1, tuning1, scope1).also { it.start() }
        coord1.awaitLoaded()
        delay(20)

        // User activates Cinema (slot 3), Motion spatial audio, ActiveSense ON, 7-band mode, and boost +6 dB.
        val sevenBandGains = listOf(3.0, 1.5, -1.0, 0.5, 2.0, 1.0, 2.5)
        tuning1.setEnabled(true)
        tuning1.setBandMode(EqBandMode.BAND_7)
        tuning1.setBandModeGains(EqBandMode.BAND_7, sevenBandGains)
        tuning1.setBoost(6.0)
        hp1.setMode(3)
        coord1.recordModeSelection(3)
        val cinemaMotion = NoiseSettings(cancellingLevel = 10, ancEnabled = true, windBlock = false, spatialAudio = SpatialAudio.HEAD)
        hp1.setNoise(cinemaMotion)
        coord1.recordNoiseChange(cinemaMotion)
        coord1.setActiveSenseEnabled(true)

        waitUntil {
            val f = File(folder.root, dbFile)
            if (!f.exists()) return@waitUntil false
            val text = f.readText(Charsets.ISO_8859_1)
            text.contains("BAND_7") && text.contains("\"boostDb\":6.0") && text.contains("\"activeSenseEnabled\":true")
        }
        scope1.coroutineContext[Job]?.cancelAndJoin()
        storeScope1.coroutineContext[Job]?.cancelAndJoin()

        // Simulate restart with reset earbuds state.
        val resetState = FakeHeadphoneRepository.connectedEarbudsState().copy(
            currentModeIndex = 0,
            noise = NoiseSettings(10, true, false, SpatialAudio.OFF),
            activeSenseEnabled = false,
        )
        val hp2 = RecordingEarbuds(resetState)
        val tuning2 = GatedFakeTuning()
        tuning2.restoreSettings(TuningSettings(enabled = false, activePresetId = null, bands = BuiltInPresets.flat.bands))

        val coord2 = EarbudStateCoordinator(storeFile(dbFile), hp2, tuning2, appScope).also { it.start() }
        coord2.awaitLoaded()
        hp2.reconnectWith(resetState)

        waitUntil { hp2.modeCalls.contains(3) && hp2.noiseCalls.contains(cinemaMotion) && hp2.activeSenseCalls.contains(true) }
        assertEquals(3, hp2.state.value.currentModeIndex)
        assertEquals(SpatialAudio.HEAD, hp2.state.value.noise?.spatialAudio)
        assertEquals(true, hp2.state.value.activeSenseEnabled)
        assertEquals(EqBandMode.BAND_7, tuning2.state.value.settings.bandMode)
        assertEquals(sevenBandGains, tuning2.state.value.settings.bandModeGains[EqBandMode.BAND_7])
        assertEquals(6.0, tuning2.state.value.settings.boostDb)

        // Also confirm switching to an AutoEq preset persists its preset ID and bands across reconnect.
        tuning2.applyPreset(BuiltInPresets.QC_ULTRA_EARBUDS_2_ID)
        waitUntil {
            val f = File(folder.root, dbFile)
            f.exists() && f.readText(Charsets.ISO_8859_1).contains(BuiltInPresets.QC_ULTRA_EARBUDS_2_ID)
        }
    }

    @Test
    fun `btd700 mode active state and custom NC plus ActiveSense overrides persist across restarts`() = runBlocking<Unit> {
        val dbFile = "earbud_btd700_persist.preferences_pb"
        val storeScope1 = CoroutineScope(Dispatchers.IO + SupervisorJob())
        val scope1 = CoroutineScope(Dispatchers.Default + SupervisorJob())
        val hp1 = RecordingEarbuds()
        val tuning1 = GatedFakeTuning()
        val coord1 = EarbudStateCoordinator(storeFile(dbFile, storeScope1), hp1, tuning1, scope1).also { it.start() }
        coord1.awaitLoaded()

        tuning1.setEnabled(true)
        coord1.setBtd700ModeEnabled(true)
        // Customize NC slider to 6 and ActiveSense to ON while BTD 700 Mode remains active.
        val customizedNoise = NoiseSettings(cancellingLevel = 6, ancEnabled = true, spatialAudio = SpatialAudio.OFF)
        hp1.setNoise(customizedNoise)
        coord1.recordNoiseChange(customizedNoise)
        coord1.setActiveSenseEnabled(true)
        waitUntil {
            val f = File(folder.root, dbFile)
            f.exists() && f.readText(Charsets.ISO_8859_1).contains("\"cancellingLevel\":6")
        }
        delay(200)
        scope1.coroutineContext[Job]?.cancelAndJoin()
        storeScope1.coroutineContext[Job]?.cancelAndJoin()

        // Reconnect with stock earbuds state -> coordinator restores BTD 700 Mode plus the user's customized NC 6 + ActiveSense ON.
        val reconnectFresh = FakeHeadphoneRepository.connectedEarbudsState().copy(
            currentModeIndex = 1,
            noise = NoiseSettings(0, true, false, SpatialAudio.OFF),
            activeSenseEnabled = false,
        )
        val hp2 = RecordingEarbuds(reconnectFresh)
        val tuning2 = GatedFakeTuning()
        val coord2 = EarbudStateCoordinator(storeFile(dbFile), hp2, tuning2, appScope).also { it.start() }
        coord2.awaitLoaded()

        assertTrue(coord2.btd700ModeActive.value)
        hp2.reconnectWith(reconnectFresh)

        waitUntil { hp2.state.value.noise?.cancellingLevel == 6 && hp2.state.value.activeSenseEnabled == true }
        assertEquals(6, hp2.state.value.noise?.cancellingLevel)
        assertEquals(true, hp2.state.value.activeSenseEnabled)
        assertTrue(coord2.btd700ModeActive.value)
    }
}
