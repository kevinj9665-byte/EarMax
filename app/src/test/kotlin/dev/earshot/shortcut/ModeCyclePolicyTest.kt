package dev.earshot.shortcut

import dev.earshot.core.HeadphoneState
import dev.earshot.core.ListeningMode
import dev.earshot.core.NoiseSettings
import dev.earshot.core.SpatialAudio
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ModeCyclePolicyTest {

    @Test
    fun `default mode cycle includes Quiet, Aware, and BTD 700 Mode with minimum 2 modes enforced`() {
        assertEquals(
            listOf(CycleModeOption.QUIET, CycleModeOption.AWARE, CycleModeOption.BTD_700),
            ModeCyclePolicy.DEFAULT_CYCLE_MODES,
        )
        // Fewer than 2 modes normalizes safely back to defaults.
        assertEquals(ModeCyclePolicy.DEFAULT_CYCLE_MODES, ModeCyclePolicy.normalize(listOf(CycleModeOption.QUIET)))
        assertEquals(ModeCyclePolicy.DEFAULT_CYCLE_MODES, ModeCyclePolicy.normalize(emptyList()))

        val onlyTwo = listOf(CycleModeOption.QUIET, CycleModeOption.BTD_700)
        assertFalse(ModeCyclePolicy.canToggle(onlyTwo, CycleModeOption.QUIET))
        assertTrue(ModeCyclePolicy.canToggle(onlyTwo, CycleModeOption.IMMERSION))
        // Toggling off when at min 2 leaves the list unchanged.
        assertEquals(onlyTwo, ModeCyclePolicy.toggle(onlyTwo, CycleModeOption.QUIET))
        // Toggling ON keeps canonical order.
        assertEquals(
            listOf(CycleModeOption.QUIET, CycleModeOption.IMMERSION, CycleModeOption.BTD_700),
            ModeCyclePolicy.toggle(onlyTwo, CycleModeOption.IMMERSION),
        )
    }

    @Test
    fun `nextOption rotates through Quiet, Aware, Immersion, Cinema, and BTD 700 Mode cleanly`() {
        val quiet = ListeningMode(0, "Quiet", isPreset = true, isEditable = false, isConfigured = true, settings = NoiseSettings(10, true, false, SpatialAudio.OFF))
        val aware = ListeningMode(1, "Aware", isPreset = true, isEditable = false, isConfigured = true, settings = NoiseSettings(0, true, false, SpatialAudio.OFF))
        val immersion = ListeningMode(2, "Immersion", isPreset = true, isEditable = false, isConfigured = true, settings = NoiseSettings(10, true, false, SpatialAudio.HEAD))
        val cinema = ListeningMode(3, "Cinema", isPreset = false, isEditable = true, isConfigured = true, settings = NoiseSettings(10, true, false, SpatialAudio.ROOM))

        val baseState = HeadphoneState(
            modes = listOf(quiet, aware, immersion, cinema),
            currentModeIndex = 0,
        )
        val cycle = listOf(CycleModeOption.QUIET, CycleModeOption.AWARE, CycleModeOption.IMMERSION, CycleModeOption.BTD_700)

        assertEquals(CycleModeOption.QUIET, ModeCyclePolicy.currentOption(baseState, btd700Active = false))
        assertEquals(CycleModeOption.AWARE, ModeCyclePolicy.nextOption(cycle, CycleModeOption.QUIET))
        assertEquals(CycleModeOption.IMMERSION, ModeCyclePolicy.nextOption(cycle, CycleModeOption.AWARE))
        assertEquals(CycleModeOption.BTD_700, ModeCyclePolicy.nextOption(cycle, CycleModeOption.IMMERSION))
        assertEquals(CycleModeOption.QUIET, ModeCyclePolicy.nextOption(cycle, CycleModeOption.BTD_700))

        // When BTD 700 Mode is active, currentOption resolves to BTD_700 regardless of underlying Bose slot.
        assertEquals(CycleModeOption.BTD_700, ModeCyclePolicy.currentOption(baseState, btd700Active = true))
        assertEquals(CycleModeOption.QUIET, ModeCyclePolicy.nextOption(cycle, CycleModeOption.BTD_700))

        // Resolve slot index matches built-in and named custom Cinema mode.
        assertEquals(0, ModeCyclePolicy.resolveSlotIndex(CycleModeOption.QUIET, baseState.modes))
        assertEquals(1, ModeCyclePolicy.resolveSlotIndex(CycleModeOption.AWARE, baseState.modes))
        assertEquals(2, ModeCyclePolicy.resolveSlotIndex(CycleModeOption.IMMERSION, baseState.modes))
        assertEquals(3, ModeCyclePolicy.resolveSlotIndex(CycleModeOption.CINEMA, baseState.modes))
    }
}
