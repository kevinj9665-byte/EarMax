package dev.earshot.ui.home

import androidx.lifecycle.viewModelScope
import dev.earshot.R
import dev.earshot.audio.EarbudStateCoordinator
import dev.earshot.bt.BtDebugLog
import dev.earshot.core.ButtonPress
import dev.earshot.core.HeadphoneCandidate
import dev.earshot.core.HeadphoneRepository
import dev.earshot.core.HeadphoneState
import dev.earshot.core.NoiseSettings
import dev.earshot.core.TransportControl
import dev.earshot.ui.common.EarshotViewModel
import dev.earshot.ui.common.UiMessenger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

class HomeViewModel(
    private val headphones: HeadphoneRepository,
    messenger: UiMessenger,
    private val earbudState: EarbudStateCoordinator? = null,
) : EarshotViewModel(messenger) {

    val state: StateFlow<HeadphoneState> = headphones.state
    val softwareWindBlock: StateFlow<Boolean> = earbudState?.windBlockActive ?: MutableStateFlow(false)
    val debugEntries: StateFlow<List<BtDebugLog.Entry>> = BtDebugLog.entries

    init {
        val initial = headphones.state.value.lastButtonPress?.atMillis
        viewModelScope.launch {
            headphones.state.map { it.lastButtonPress }.filterNotNull()
                .distinctUntilChanged { a, b -> a.atMillis == b.atMillis }
                .filter { it.atMillis != initial }
                .collect { press -> messenger.show(R.string.button_press_line, buttonName(press), eventName(press), press.action.label) }
        }
    }

    fun connect() = headphones.connect()
    fun refresh() = launchCatching { headphones.refresh() }

    /** The header's device switcher: remember [address] as the headphones and connect to it. */
    fun chooseDevice(address: String, name: String?) = launchCatching { headphones.chooseDevice(address, name) }

    /** Bonded devices for the switcher; an empty list (not an error) when Bluetooth can't be read. */
    suspend fun candidates(): List<HeadphoneCandidate> = runCatching { headphones.deviceCandidates() }.getOrDefault(emptyList())

    fun setMode(index: Int) = launchCatching {
        headphones.setMode(index)
        earbudState?.recordModeSelection(index)
    }

    /** Skullcandy Crusher haptic bass; whatever is null stays as it is on the headphones. */
    fun setCrusherBass(active: Boolean?, intensity: Int?, mode: Int?) = launchCatching { headphones.setCrusherBass(active, intensity, mode) }

    fun toggleFavorite(index: Int) = launchCatching {
        val current = headphones.state.value.modes.filter { it.isFavorite }.map { it.index }.toSet()
        headphones.setFavorites(if (index in current) current - index else current + index)
    }

    /** [31.10] applies immediately; the noise panel sends the whole struct after each gesture. */
    fun setNoise(settings: NoiseSettings) = launchCatching {
        headphones.setNoise(settings)
        earbudState?.recordNoiseChange(settings)
    }

    fun setSoftwareWindBlock(enabled: Boolean) = launchCatching {
        earbudState?.setWindBlockEnabled(enabled)
    }

    fun setVendorControl(id: String, value: Int) = launchCatching { headphones.setVendorControl(id, value) }

    fun transport(control: TransportControl) = launchCatching { headphones.transport(control) }
    fun setVolume(level: Int) = launchCatching { headphones.setVolume(level) }

    fun clearDebugLog() = BtDebugLog.clear()

    private fun buttonName(press: ButtonPress): String = press.buttonLabel ?: "Button ${press.buttonId}"
    private fun eventName(press: ButtonPress): String = (press.eventLabel ?: "event ${press.eventType}").lowercase()
}
