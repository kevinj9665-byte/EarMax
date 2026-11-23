package dev.earshot.shortcut

import dev.earshot.core.HeadphoneState
import dev.earshot.core.ListeningMode
import dev.earshot.core.SpatialAudio
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The 5 listening modes the user can include in their custom tap-and-hold mode cycle.
 * Stored by stable serial name; defaults to [Quiet, Aware, BTD 700 Mode] with >= 2 required.
 */
@Serializable
enum class CycleModeOption(val defaultLabel: String) {
    @SerialName("quiet") QUIET("Quiet"),
    @SerialName("aware") AWARE("Aware"),
    @SerialName("immersion") IMMERSION("Immersion"),
    @SerialName("cinema") CINEMA("Cinema"),
    @SerialName("btd700") BTD_700("BTD 700 Mode"),
}

/**
 * Pure policy for validating, editing, and advancing the user's custom listening-mode cycle.
 */
object ModeCyclePolicy {
    const val MIN_MODES = 2

    val DEFAULT_CYCLE_MODES: List<CycleModeOption> = listOf(
        CycleModeOption.QUIET,
        CycleModeOption.AWARE,
        CycleModeOption.BTD_700,
    )

    /** Ensures at least [MIN_MODES] distinct entries in canonical order; falls back to [DEFAULT_CYCLE_MODES]. */
    fun normalize(modes: List<CycleModeOption>): List<CycleModeOption> {
        val distinct = CycleModeOption.entries.filter { it in modes }
        return if (distinct.size >= MIN_MODES) distinct else DEFAULT_CYCLE_MODES
    }

    /** True if toggling [option] would leave at least [MIN_MODES] checked modes. */
    fun canToggle(current: List<CycleModeOption>, option: CycleModeOption): Boolean {
        val normalized = normalize(current)
        return option !in normalized || normalized.size > MIN_MODES
    }

    /** Toggles [option] if allowed; refuses unchecking below [MIN_MODES]. Maintains canonical order. */
    fun toggle(current: List<CycleModeOption>, option: CycleModeOption): List<CycleModeOption> {
        val normalized = normalize(current)
        return if (option in normalized) {
            if (normalized.size <= MIN_MODES) normalized else normalized - option
        } else {
            CycleModeOption.entries.filter { it == option || it in normalized }
        }
    }

    /** Which cycle entry is currently active based on BTD 700 state and headphone mode/spatial state. */
    fun currentOption(state: HeadphoneState, btd700Active: Boolean): CycleModeOption? {
        if (btd700Active) return CycleModeOption.BTD_700
        val modeName = state.currentMode?.name?.trim()?.lowercase()
        when (modeName) {
            "quiet" -> return CycleModeOption.QUIET
            "aware" -> return CycleModeOption.AWARE
            "immersion" -> return CycleModeOption.IMMERSION
            "cinema" -> return CycleModeOption.CINEMA
        }
        return when (state.noise?.spatialAudio) {
            SpatialAudio.HEAD -> CycleModeOption.IMMERSION
            SpatialAudio.ROOM -> CycleModeOption.CINEMA
            else -> when (state.currentModeIndex) {
                0 -> CycleModeOption.QUIET
                1 -> CycleModeOption.AWARE
                2 -> CycleModeOption.IMMERSION
                3 -> CycleModeOption.CINEMA
                else -> null
            }
        }
    }

    /** Advances to the next mode in [cycle] after [current], wrapping cleanly. */
    fun nextOption(cycle: List<CycleModeOption>, current: CycleModeOption?): CycleModeOption {
        val normalized = normalize(cycle)
        val idx = normalized.indexOf(current)
        return if (idx < 0) normalized.first() else normalized[(idx + 1) % normalized.size]
    }

    /** Resolves a headset listening-mode slot index for [option], or null for [CycleModeOption.BTD_700]. */
    fun resolveSlotIndex(option: CycleModeOption, modes: List<ListeningMode>): Int? {
        if (option == CycleModeOption.BTD_700) return null
        val configured = modes.filter { it.isConfigured }
        val targetName = when (option) {
            CycleModeOption.QUIET -> "quiet"
            CycleModeOption.AWARE -> "aware"
            CycleModeOption.IMMERSION -> "immersion"
            CycleModeOption.CINEMA -> "cinema"
            CycleModeOption.BTD_700 -> return null
        }
        configured.firstOrNull { it.name.trim().equals(targetName, ignoreCase = true) }?.let { return it.index }
        val fallbackIdx = when (option) {
            CycleModeOption.QUIET -> 0
            CycleModeOption.AWARE -> 1
            CycleModeOption.IMMERSION -> 2
            CycleModeOption.CINEMA -> 3
            CycleModeOption.BTD_700 -> -1
        }
        return configured.firstOrNull { it.index == fallbackIdx }?.index
    }
}
