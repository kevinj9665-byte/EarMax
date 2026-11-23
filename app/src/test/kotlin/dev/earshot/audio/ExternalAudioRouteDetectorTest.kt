package dev.earshot.audio

import dev.earshot.core.AudioOutputRoute
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ExternalAudioRouteDetectorTest {

    @Test
    fun `USB-C audio outputs like BTD 700 unlock Pro EQ and Volume Boost`() {
        for (usbType in listOf(
            ExternalAudioRouteDetector.TYPE_USB_DEVICE,
            ExternalAudioRouteDetector.TYPE_USB_HEADSET,
            ExternalAudioRouteDetector.TYPE_USB_ACCESSORY,
        )) {
            val res = ExternalAudioRouteDetector.detect(
                ExternalAudioRouteDetector.Snapshot(
                    outputDeviceTypes = setOf(usbType),
                    btd700ModeActive = false,
                    controlLinkActive = false,
                ),
            )
            assertEquals(AudioOutputRoute.USB_AUDIO, res.route, "USB type $usbType should map to USB_AUDIO")
            assertTrue(res.isExternalOutputActive, "USB type $usbType must unlock external DSP")
        }
    }

    @Test
    fun `active BTD 700 Mode unlocks lossless external DSP even when no Bluetooth audio route is active`() {
        val res = ExternalAudioRouteDetector.detect(
            ExternalAudioRouteDetector.Snapshot(
                outputDeviceTypes = setOf(ExternalAudioRouteDetector.TYPE_BUILTIN_SPEAKER),
                btd700ModeActive = true,
                controlLinkActive = false,
            ),
        )
        assertEquals(AudioOutputRoute.BTD700_LOSSLESS, res.route)
        assertTrue(res.isExternalOutputActive)
    }

    @Test
    fun `Bluetooth A2DP and LE Audio unlock external DSP`() {
        for (btType in listOf(
            ExternalAudioRouteDetector.TYPE_BLUETOOTH_A2DP,
            ExternalAudioRouteDetector.TYPE_BLE_HEADSET,
        )) {
            val res = ExternalAudioRouteDetector.detect(
                ExternalAudioRouteDetector.Snapshot(outputDeviceTypes = setOf(btType)),
            )
            assertEquals(AudioOutputRoute.BLUETOOTH_A2DP, res.route)
            assertTrue(res.isExternalOutputActive)
        }
    }

    @Test
    fun `active Bose control link keeps Pro EQ unlocked even if Android omits A2DP descriptor`() {
        val res = ExternalAudioRouteDetector.detect(
            ExternalAudioRouteDetector.Snapshot(
                outputDeviceTypes = emptySet(),
                btd700ModeActive = false,
                controlLinkActive = true,
            ),
        )
        assertEquals(AudioOutputRoute.BOSE_CONTROL_LINK, res.route)
        assertTrue(res.isExternalOutputActive)
    }

    @Test
    fun `phone speaker and earpiece alone pause Pro EQ and report PHONE_SPEAKER`() {
        val res = ExternalAudioRouteDetector.detect(
            ExternalAudioRouteDetector.Snapshot(
                outputDeviceTypes = setOf(
                    ExternalAudioRouteDetector.TYPE_BUILTIN_SPEAKER,
                    ExternalAudioRouteDetector.TYPE_BUILTIN_EARPIECE,
                ),
                btd700ModeActive = false,
                controlLinkActive = false,
            ),
        )
        assertEquals(AudioOutputRoute.PHONE_SPEAKER, res.route)
        assertFalse(res.isExternalOutputActive)
    }
}
