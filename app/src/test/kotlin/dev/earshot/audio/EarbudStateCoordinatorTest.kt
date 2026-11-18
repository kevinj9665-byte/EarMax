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
import dev.earshot.dsp.ParametricBand
import dev.earshot.dsp.TuningSettings
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.Job
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
    fun `software wind block engages Quiet max ANC and sub-100Hz cut, then restores previous mode and custom EQ on toggle off`() = runBlocking<Unit> {
        val hp = RecordingEarbuds()
        val tuning = GatedFakeTuning()
        val coordinator = EarbudStateCoordinator(storeFile(), hp, tuning, appScope).also { it.start() }
        coordinator.awaitLoaded()

        // User configures custom EQ curve and Aware mode with Still spatial audio.
        val customBands = listOf(
            ParametricBand(60.0, 4.5, 1.0),
            ParametricBand(1000.0, -2.0, 1.4),
        )
        tuning.setEnabled(true)
        tuning.setBands(customBands)
        tuning.setBoost(2.5)
        hp.setMode(1) // Aware
        coordinator.recordModeSelection(1)
        val awareStill = NoiseSettings(cancellingLevel = 2, ancEnabled = true, windBlock = false, spatialAudio = SpatialAudio.ROOM)
        hp.setNoise(awareStill)
        coordinator.recordNoiseChange(awareStill)

        // Toggle Software Wind Block ON.
        coordinator.setWindBlockEnabled(true)
        assertTrue(coordinator.windBlockActive.value)
        assertEquals(0, hp.state.value.currentModeIndex, "Expected Quiet mode (slot 0)")
        assertEquals(10, hp.state.value.noise?.cancellingLevel, "Expected Max ANC level 10")
        assertTrue(hp.state.value.noise?.ancEnabled == true)
        assertTrue(tuning.state.value.settings.windCutEnabled, "Expected <100 Hz cut active in Pro EQ")
        assertEquals(customBands, tuning.state.value.settings.bands, "User EQ sliders remain non-destructively preserved")

        // Toggle Software Wind Block OFF -> restores Aware mode, Still spatial audio, and original EQ curve.
        coordinator.setWindBlockEnabled(false)
        assertFalse(coordinator.windBlockActive.value)
        assertEquals(1, hp.state.value.currentModeIndex, "Expected previous Aware mode restored")
        assertEquals(awareStill, hp.state.value.noise, "Expected previous noise & spatial settings restored")
        assertFalse(tuning.state.value.settings.windCutEnabled, "Expected <100 Hz cut disengaged")
        assertEquals(customBands, tuning.state.value.settings.bands, "Expected exact custom EQ curve restored")
        assertEquals(2.5, tuning.state.value.settings.boostDb)
    }

    @Test
    fun `persisted AutoEq preset, custom EQ, and last listening mode + immersive audio restore automatically on reconnect`() = runBlocking<Unit> {
        val dbFile = "earbud_persist.preferences_pb"
        val storeScope1 = CoroutineScope(Dispatchers.IO + SupervisorJob())
        val scope1 = CoroutineScope(Dispatchers.Default + SupervisorJob())
        val hp1 = RecordingEarbuds()
        val tuning1 = GatedFakeTuning()
        val coord1 = EarbudStateCoordinator(storeFile(dbFile, storeScope1), hp1, tuning1, scope1).also { it.start() }
        coord1.awaitLoaded()
        delay(20)

        // User activates Cinema (slot 3), Motion spatial audio, and a preset / custom settings.
        tuning1.setEnabled(true)
        tuning1.applyPreset(BuiltInPresets.QC_ULTRA_EARBUDS_2_ID)
        hp1.setMode(3)
        coord1.recordModeSelection(3)
        val cinemaMotion = NoiseSettings(cancellingLevel = 10, ancEnabled = true, windBlock = false, spatialAudio = SpatialAudio.HEAD)
        hp1.setNoise(cinemaMotion)
        coord1.recordNoiseChange(cinemaMotion)

        // Wait until collector persists TuningSettings into DataStore, then cleanly close store #1.
        waitUntil {
            val f = File(folder.root, dbFile)
            f.exists() && f.readText(Charsets.ISO_8859_1).contains(BuiltInPresets.QC_ULTRA_EARBUDS_2_ID)
        }
        scope1.coroutineContext[Job]?.cancelAndJoin()
        storeScope1.coroutineContext[Job]?.cancelAndJoin()

        // Simulate app restart with fresh repository instances whose state starts reset (slot 0 / Off / neutral EQ).
        val resetState = FakeHeadphoneRepository.connectedEarbudsState().copy(
            currentModeIndex = 0,
            noise = NoiseSettings(10, true, false, SpatialAudio.OFF),
        )
        val hp2 = RecordingEarbuds(resetState)
        val tuning2 = GatedFakeTuning()
        tuning2.restoreSettings(TuningSettings(enabled = false, activePresetId = null, bands = BuiltInPresets.flat.bands))

        val coord2 = EarbudStateCoordinator(storeFile(dbFile), hp2, tuning2, appScope).also { it.start() }
        coord2.awaitLoaded()

        // Fire reconnect event.
        hp2.reconnectWith(resetState)

        waitUntil { hp2.modeCalls.contains(3) && hp2.noiseCalls.contains(cinemaMotion) }
        assertEquals(3, hp2.state.value.currentModeIndex)
        assertEquals(SpatialAudio.HEAD, hp2.state.value.noise?.spatialAudio)
        assertEquals(BuiltInPresets.QC_ULTRA_EARBUDS_2_ID, tuning2.state.value.settings.activePresetId)
        assertEquals(BuiltInPresets.tunedForQcUltraEarbuds2.bands, tuning2.state.value.settings.bands)
    }

    @Test
    fun `wind block active state also persists across restarts and re-applies on reconnect`() = runBlocking<Unit> {
        val dbFile = "earbud_wind_persist.preferences_pb"
        val storeScope1 = CoroutineScope(Dispatchers.IO + SupervisorJob())
        val scope1 = CoroutineScope(Dispatchers.Default + SupervisorJob())
        val hp1 = RecordingEarbuds()
        val tuning1 = GatedFakeTuning()
        val coord1 = EarbudStateCoordinator(storeFile(dbFile, storeScope1), hp1, tuning1, scope1).also { it.start() }
        coord1.awaitLoaded()

        tuning1.setEnabled(true)
        hp1.setMode(1) // Aware
        coord1.recordModeSelection(1)
        coord1.setWindBlockEnabled(true)
        waitUntil { File(folder.root, dbFile).length() > 0 }
        delay(200)
        scope1.coroutineContext[Job]?.cancelAndJoin()
        storeScope1.coroutineContext[Job]?.cancelAndJoin()

        // Reconnect in Aware mode -> coordinator must immediately engage Quiet max ANC + windCut.
        val reconnectInAware = FakeHeadphoneRepository.connectedEarbudsState().copy(
            currentModeIndex = 1,
            noise = NoiseSettings(0, true, false, SpatialAudio.OFF),
        )
        val hp2 = RecordingEarbuds(reconnectInAware)
        val tuning2 = GatedFakeTuning()
        val coord2 = EarbudStateCoordinator(storeFile(dbFile), hp2, tuning2, appScope).also { it.start() }
        coord2.awaitLoaded()

        assertTrue(coord2.windBlockActive.value)
        hp2.reconnectWith(reconnectInAware)

        waitUntil { hp2.state.value.currentModeIndex == 0 && tuning2.state.value.settings.windCutEnabled }
        assertEquals(10, hp2.state.value.noise?.cancellingLevel)

        // Now turn Wind Block OFF -> still restores Aware mode even after restart!
        coord2.setWindBlockEnabled(false)
        assertFalse(coord2.windBlockActive.value)
        assertEquals(1, hp2.state.value.currentModeIndex)
        assertFalse(tuning2.state.value.settings.windCutEnabled)
    }
}
