package dev.earshot.audio

import dev.earshot.core.AudioOutputRoute

/**
 * Pure audio-routing policy for Pro EQ and Volume Boost.
 *
 * Unlocks DSP for:
 *  - USB-C DACs / transmitters such as the Sennheiser BTD 700 (`TYPE_USB_DEVICE`, `TYPE_USB_HEADSET`, `TYPE_USB_ACCESSORY`)
 *  - Active BTD 700 Mode
 *  - Bluetooth A2DP / LE Audio headsets (`TYPE_BLUETOOTH_A2DP`, `TYPE_BLE_HEADSET`)
 *  - Active Bose BMAP/BLE control connections (`controlLinkActive`)
 *
 * Pauses DSP only when playback is routing strictly through the phone's built-in speaker or earpiece.
 */
internal object ExternalAudioRouteDetector {

    const val TYPE_BUILTIN_EARPIECE = 1
    const val TYPE_BUILTIN_SPEAKER = 2
    const val TYPE_BLUETOOTH_A2DP = 8
    const val TYPE_USB_DEVICE = 11
    const val TYPE_USB_ACCESSORY = 12
    const val TYPE_USB_HEADSET = 22
    const val TYPE_BLE_HEADSET = 26
    const val TYPE_BLE_SPEAKER = 27

    val USB_OUTPUT_TYPES: Set<Int> = setOf(
        TYPE_USB_DEVICE,
        TYPE_USB_ACCESSORY,
        TYPE_USB_HEADSET,
    )

    val BLUETOOTH_OUTPUT_TYPES: Set<Int> = setOf(
        TYPE_BLUETOOTH_A2DP,
        TYPE_BLE_HEADSET,
        TYPE_BLE_SPEAKER,
    )

    data class Snapshot(
        val outputDeviceTypes: Set<Int> = emptySet(),
        val btd700ModeActive: Boolean = false,
        val controlLinkActive: Boolean = false,
    )

    data class Result(
        val route: AudioOutputRoute,
        val isExternalOutputActive: Boolean,
    )

    fun detect(snapshot: Snapshot): Result {
        val hasUsb = snapshot.outputDeviceTypes.any { it in USB_OUTPUT_TYPES }
        val hasBt = snapshot.outputDeviceTypes.any { it in BLUETOOTH_OUTPUT_TYPES }
        return when {
            snapshot.btd700ModeActive -> Result(AudioOutputRoute.BTD700_LOSSLESS, isExternalOutputActive = true)
            hasUsb -> Result(AudioOutputRoute.USB_AUDIO, isExternalOutputActive = true)
            hasBt -> Result(AudioOutputRoute.BLUETOOTH_A2DP, isExternalOutputActive = true)
            snapshot.controlLinkActive -> Result(AudioOutputRoute.BOSE_CONTROL_LINK, isExternalOutputActive = true)
            else -> Result(AudioOutputRoute.PHONE_SPEAKER, isExternalOutputActive = false)
        }
    }
}
