package dev.earshot.dsp

import kotlinx.serialization.Serializable

/**
 * Shared equaliser model. This file is the contract between the DSP module, the audio
 * engine in the app and the UI. Keep it plain data; the maths lives next to it in this module.
 */
@Serializable
enum class FilterType { PEAK, LOW_SHELF, HIGH_SHELF }

@Serializable
data class ParametricBand(
    val frequencyHz: Double,
    val gainDb: Double,
    val q: Double = 1.41,
    val type: FilterType = FilterType.PEAK,
    val enabled: Boolean = true,
) {
    companion object {
        const val MIN_GAIN_DB = -15.0
        const val MAX_GAIN_DB = 15.0
        const val MIN_Q = 0.1
        const val MAX_Q = 10.0
    }
}

@Serializable
data class EqPreset(
    val id: String,
    val name: String,
    val bands: List<ParametricBand>,
    /** Applied before the bands; negative values keep boosted bands from clipping. */
    val preampDb: Double = 0.0,
    val isBuiltIn: Boolean = false,
    val description: String? = null,
)

/** One slider definition inside an [EqBandMode]. */
data class EqBandSpec(
    val frequencyHz: Double,
    val label: String,
    val role: String,
    val q: Double = GraphicEq.DEFAULT_Q,
)

/** Selectable Pro EQ band layouts matching Bose Style 3-band plus 4, 5, and 7-band layouts. */
@Serializable
enum class EqBandMode(
    val bandCount: Int,
    val shortLabel: String,
    val displayName: String,
    val specs: List<EqBandSpec>,
) {
    BAND_3(
        bandCount = 3,
        shortLabel = "3-Band",
        displayName = "3-Band (Bose Style)",
        specs = listOf(
            EqBandSpec(60.0, "Bass", "Sub & Punch", q = 1.0),
            EqBandSpec(1000.0, "Mid", "Vocals & Instruments", q = 1.0),
            EqBandSpec(8000.0, "Treble", "Clarity & Sparkle", q = 1.0),
        ),
    ),
    BAND_4(
        bandCount = 4,
        shortLabel = "4-Band",
        displayName = "4-Band",
        specs = listOf(
            EqBandSpec(60.0, "Bass", "Sub & Rumble", q = 1.1),
            EqBandSpec(300.0, "Low-Mids", "Warmth & Body", q = 1.15),
            EqBandSpec(2500.0, "High-Mids", "Vocal Presence", q = 1.15),
            EqBandSpec(10000.0, "Treble", "Air & Detail", q = 1.1),
        ),
    ),
    BAND_5(
        bandCount = 5,
        shortLabel = "5-Band",
        displayName = "5-Band",
        specs = listOf(
            EqBandSpec(60.0, "Sub-Bass", "Deep Low End", q = 1.2),
            EqBandSpec(230.0, "Bass", "Mid-Bass Punch", q = 1.25),
            EqBandSpec(910.0, "Mids", "Vocals & Guitar", q = 1.25),
            EqBandSpec(3600.0, "High-Mids", "Clarity & Edge", q = 1.25),
            EqBandSpec(14000.0, "Treble", "Air & Shimmer", q = 1.2),
        ),
    ),
    BAND_7(
        bandCount = 7,
        shortLabel = "7-Band",
        displayName = "7-Band",
        specs = listOf(
            EqBandSpec(60.0, "Sub-Bass", "Deep Rumble", q = 1.35),
            EqBandSpec(150.0, "Mid-Bass", "Warmth & Kick", q = 1.35),
            EqBandSpec(400.0, "Low-Mids", "Boxiness / Body", q = 1.35),
            EqBandSpec(1000.0, "Mids", "Core Vocals", q = 1.35),
            EqBandSpec(2400.0, "High-Mids", "Presence", q = 1.35),
            EqBandSpec(6000.0, "Presence", "Sibilance / Detail", q = 1.35),
            EqBandSpec(14000.0, "Treble", "Air & Sparkle", q = 1.35),
        ),
    );

    fun bandsFromGains(gainsDb: List<Double>): List<ParametricBand> {
        require(gainsDb.size == bandCount) { "expected $bandCount gains for $name" }
        return specs.zip(gainsDb) { spec, g ->
            ParametricBand(
                frequencyHz = spec.frequencyHz,
                gainDb = g.coerceIn(ParametricBand.MIN_GAIN_DB, ParametricBand.MAX_GAIN_DB),
                q = spec.q,
            )
        }
    }

    /** Sample an existing band list onto this mode's centre frequencies (used when migrating presets/curves). */
    fun sampleGainsFrom(bands: List<ParametricBand>): List<Double> {
        if (bands.none { it.enabled && kotlin.math.abs(it.gainDb) > 0.01 }) {
            return List(bandCount) { 0.0 }
        }
        val response = EqResponse(bands, preampDb = 0.0)
        return specs.map { spec ->
            val sampled = response.bandsOnlyDb(spec.frequencyHz)
                .coerceIn(ParametricBand.MIN_GAIN_DB, ParametricBand.MAX_GAIN_DB)
            kotlin.math.round(sampled * 10.0) / 10.0
        }
    }
}

/** The 10 ISO centre frequencies kept for backward-compatible presets and response math. */
object GraphicEq {
    val FREQUENCIES_HZ: List<Double> = listOf(31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0)
    const val BAND_COUNT = 10
    /** Octave-spaced graphic bands overlap nicely at this Q. */
    const val DEFAULT_Q = 1.41

    fun bandsFromGains(gainsDb: List<Double>): List<ParametricBand> {
        require(gainsDb.size == BAND_COUNT) { "expected $BAND_COUNT gains" }
        return FREQUENCIES_HZ.zip(gainsDb) { f, g -> ParametricBand(frequencyHz = f, gainDb = g, q = DEFAULT_Q) }
    }
}

/** What the sound engine should be doing right now. Persisted by the app. */
@Serializable
data class TuningSettings(
    val enabled: Boolean = false,
    val activePresetId: String? = null,
    /** Live bands being edited; when [activePresetId] is set these mirror that preset. */
    val bands: List<ParametricBand> = GraphicEq.bandsFromGains(List(GraphicEq.BAND_COUNT) { 0.0 }),
    val preampDb: Double = 0.0,
    /** Extra loudness in dB, 0..[MAX_BOOST_DB]. */
    val boostDb: Double = 0.0,
    val limiterEnabled: Boolean = true,
    /** Active Pro EQ graphic band layout (3, 4, 5, or 7 bands). */
    val bandMode: EqBandMode = EqBandMode.BAND_5,
    /** Saved custom slider gains per [EqBandMode] so switching layouts preserves each configuration. */
    val bandModeGains: Map<EqBandMode, List<Double>> = emptyMap(),
) {
    companion object {
        const val MAX_BOOST_DB = 12.0
        /** Above this the UI shows the hearing-safety warning. */
        const val BOOST_WARNING_DB = 6.0
    }
}
