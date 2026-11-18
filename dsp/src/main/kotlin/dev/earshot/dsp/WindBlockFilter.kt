package dev.earshot.dsp

/**
 * Software Wind Block DSP filter for Bose QuietComfort Ultra Earbuds (2nd Gen), which lack a native
 * hardware Wind Block toggle in firmware.
 *
 * Composes non-destructively on top of the listener's active EQ bands: sub-100 Hz positive boosts
 * are suppressed and two cascaded low-shelf cuts strongly attenuate wind-rumble frequencies below
 * 100 Hz (> 15 dB cut below 65 Hz) while leaving vocals and mids above 250 Hz essentially untouched.
 */
object WindBlockFilter {
    const val CUTOFF_HZ = 100.0

    val WIND_CUT_BANDS: List<ParametricBand> = listOf(
        ParametricBand(frequencyHz = 95.0, gainDb = -12.0, q = 0.71, type = FilterType.LOW_SHELF),
        ParametricBand(frequencyHz = 55.0, gainDb = -12.0, q = 0.71, type = FilterType.LOW_SHELF),
    )

    fun effectiveBands(bands: List<ParametricBand>, windCutEnabled: Boolean): List<ParametricBand> {
        if (!windCutEnabled) return bands
        val trimmed = bands.filterNot {
            it.gainDb > 0.0 && (it.frequencyHz < CUTOFF_HZ || (it.type == FilterType.LOW_SHELF && it.frequencyHz <= 125.0))
        }
        return trimmed + WIND_CUT_BANDS
    }
}
