package dev.earshot.ui

import dev.earshot.core.ButtonAction
import dev.earshot.core.HeadphoneState
import dev.earshot.core.fake.FakeHeadphoneRepository
import dev.earshot.shortcut.CycleModeOption
import dev.earshot.shortcut.HandlerStatus
import dev.earshot.shortcut.HfpHeadset
import dev.earshot.shortcut.ModeCyclePolicy
import dev.earshot.shortcut.ShortcutAction
import dev.earshot.shortcut.ShortcutSettings
import dev.earshot.ui.tools.RemapperHeadset
import dev.earshot.ui.tools.ShortcutChoice
import dev.earshot.ui.tools.ShortcutsUiState
import dev.earshot.ui.tools.choice
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The Shortcuts remapper screen's decisions: which headset, which options, the hint. */
class RemapperLogicTest {
    private val buds = HfpHeadset("AA:BB:CC:DD:EE:01", "Pixel Buds Pro")

    @Test
    fun `the headset at the top is Earshot's, else the phone's HFP headset, else none`() {
        val bose = RemapperHeadset.resolve(FakeHeadphoneRepository.connectedState(), buds)
        assertEquals(FakeHeadphoneRepository.DEVICE_ADDRESS, bose?.address)
        assertTrue(bose!!.viaEarshot)
        assertFalse(bose.earbuds)

        val other = RemapperHeadset.resolve(HeadphoneState(), buds)
        assertEquals(RemapperHeadset(buds.address, buds.name, earbuds = true, viaEarshot = false), other)

        assertNull(RemapperHeadset.resolve(HeadphoneState(), null))
        assertTrue(RemapperHeadset.resolve(FakeHeadphoneRepository.connectedEarbudsState(), null)!!.earbuds)
    }

    @Test
    fun `dropdown offers Earshot's actions, native modes on headphones, and the 6 required options on earbuds`() {
        val base = listOf(
            ShortcutChoice.CYCLE_LISTENING_MODES,
            ShortcutChoice.PHONE_ASSISTANT,
            ShortcutChoice.CYCLE_EQ,
            ShortcutChoice.VOICE_MEMO,
            ShortcutChoice.LAUNCH_APP,
        )
        assertEquals(base, ShortcutChoice.options(emptyList(), ShortcutChoice.CYCLE_EQ))
        assertEquals(
            base + ShortcutChoice.IMMERSIVE_AUDIO + ShortcutChoice.OFF,
            ShortcutChoice.options(listOf(ButtonAction.SPATIAL_AUDIO, ButtonAction.DISABLED), ShortcutChoice.PHONE_ASSISTANT),
        )
        assertEquals(base + ShortcutChoice.OFF, ShortcutChoice.options(listOf(ButtonAction.DISABLED), ShortcutChoice.OFF))
        // A saved native choice stays visible while that headset isn't connected through Earshot.
        assertEquals(base + ShortcutChoice.IMMERSIVE_AUDIO, ShortcutChoice.options(emptyList(), ShortcutChoice.IMMERSIVE_AUDIO))

        // Earbuds always present all 6 required options for both Right and Left buds.
        assertEquals(
            listOf(
                ShortcutChoice.CYCLE_LISTENING_MODES,
                ShortcutChoice.IMMERSIVE_AUDIO,
                ShortcutChoice.CYCLE_EQ,
                ShortcutChoice.PHONE_ASSISTANT,
                ShortcutChoice.LAUNCH_APP,
                ShortcutChoice.OFF,
            ),
            ShortcutChoice.options(emptyList(), ShortcutChoice.CYCLE_LISTENING_MODES, earbuds = true),
        )
    }

    @Test
    fun `screen state ties the policy together`() {
        val hp = FakeHeadphoneRepository.connectedState() // button on Immersive Audio, QC Ultra 2 list
        val headset = RemapperHeadset.resolve(hp, null)
        val fresh = ShortcutsUiState(handler = HandlerStatus.Chooser, headset = headset, button = hp.shortcutButton)
        assertEquals(ShortcutChoice.IMMERSIVE_AUDIO, fresh.choice.choice())
        assertEquals(listOf(ButtonAction.SPATIAL_AUDIO, ButtonAction.DISABLED), fresh.nativeModes)
        assertFalse(fresh.showFirstPressHint)

        val eq = fresh.copy(settings = ShortcutSettings().withChoice(headset!!.address, headset.name, ShortcutAction.CycleEq))
        assertEquals(ShortcutAction.CycleEq, eq.choice)
        assertTrue(eq.showFirstPressHint)
        assertFalse(eq.copy(handler = HandlerStatus.Earshot).showFirstPressHint)
        assertFalse(eq.copy(settings = eq.settings.copy(seenHeadsetPress = true)).showFirstPressHint)

        // Not through Earshot: no native modes.
        assertTrue(ShortcutsUiState(headset = RemapperHeadset.resolve(HeadphoneState(), buds)).nativeModes.isEmpty())
    }

    @Test
    fun `one row per Bose record, independent secondary action, mode cycle defaults, and detected control`() {
        val hp = FakeHeadphoneRepository.connectedEarbudsState()
        val headset = RemapperHeadset.resolve(hp, null)!!
        val modes = listOf(ButtonAction.VOICE_ASSISTANT, ButtonAction.DISABLED, ButtonAction.SPATIAL_AUDIO, ButtonAction.MODES_CAROUSEL)
        val right = dev.earshot.core.ButtonAssignment(0x03, 9, ButtonAction.VOICE_ASSISTANT, modes)
        val left = right.copy(buttonId = 0x04)
        val s = ShortcutsUiState(
            headset = headset,
            settings = ShortcutSettings().withButtonAction(headset.address, 0x04, ShortcutAction.CycleModes),
            button = right,
            buttons = listOf(right, left),
        )
        assertEquals(listOf(left), s.secondaryButtons)
        assertEquals(ShortcutAction.CycleModes, s.secondaryAction(left))
        assertEquals(ModeCyclePolicy.DEFAULT_CYCLE_MODES, s.modeCycle)
        assertEquals(listOf(CycleModeOption.QUIET, CycleModeOption.AWARE, CycleModeOption.BTD_700), s.modeCycle)
        assertTrue(s.sharesAssistant)
        assertFalse(s.copy(buttons = listOf(right, left.copy(action = ButtonAction.DISABLED))).sharesAssistant)
        // A single-button product, or a headset without BMAP: no extra rows.
        assertTrue(ShortcutsUiState(headset = headset, button = right).secondaryButtons.isEmpty())
        assertTrue(ShortcutsUiState(headset = RemapperHeadset.resolve(HeadphoneState(), buds), buttons = emptyList()).secondaryButtons.isEmpty())

        val seen = s.copy(settings = ShortcutSettings().withDetected(headset.address, 1L))
        assertEquals(headset.address.uppercase(), seen.detected?.address)
        assertEquals(null, s.detected)
    }
}
