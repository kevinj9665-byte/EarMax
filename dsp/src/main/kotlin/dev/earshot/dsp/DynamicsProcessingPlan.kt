package dev.earshot.dsp

import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Translates our parametric model into what Android's `android.media.audiofx.DynamicsProcessing`
 * can actually be told.
 *
 * DynamicsProcessing is *band*-based, not biquad-based: its post-EQ stage is a bank of N
 * contiguous bands, each defined only by an upper `cutoffFrequency` and a `gain`, with the
 * framework cross-fading neighbours. There is no Q, no filter type and no way to place a true
 * peaking filter. So we approximate:
 *
 *  1. Split 20 Hz–20 kHz into [bandCount] log-spaced bands (equal width in octaves; with the
 *     default 32 bands each is ~0.31 octave, i.e. slightly finer than a 1/3-octave graphic EQ).
 *     Band 0 implicitly also covers 0–20 Hz and the last band runs on to Nyquist, which is what
 *     the framework does with the first/last cutoffs anyway.
 *  2. Compute the exact combined biquad response ([EqResponse]) of the enabled bands, *without*
 *     the preamp, and sample it at each band's geometric centre. That sample becomes the band gain.
 *  3. Preamp and loudness boost are flat gains, so they go into the effect's input gain stage
 *     instead of being baked into every band ([Plan.inputGainDb]).
 *  4. The limiter stage runs after the EQ with fixed, fast "brickwall-ish" parameters
 *     ([LimiterParams]); the plan only toggles it.
 *
 * What this loses: features narrower than one band (a Q=5 notch at 6 kHz is ~0.3 octave wide,
 * the same as the band, so it survives but shallower); the ±0.3 dB ripple of the framework's
 * cross-fades; and anything the hardware DSP rounds. For headphone correction curves and
 * graphic-EQ-style tweaks the result is audibly the same as the parametric curve.
 */
object DynamicsProcessingPlan {
    const val DEFAULT_BAND_COUNT = 32
    const val MBC_BAND_COUNT = 4
    const val DEFAULT_SAMPLE_RATE = 48000
    const val MIN_FREQ_HZ = 20.0
    const val MAX_FREQ_HZ = 20000.0
    const val SUB_BASS_CUTOFF_HZ = 55.0

    /** One post-EQ band: everything below [cutoffHz] (down to the previous band) gets [gainDb]. */
    data class Band(val cutoffHz: Double, val gainDb: Double)

    /**
     * Stage 1 multi-band compressor parameters tailored for QC Ultra Earbuds (2nd Gen):
     * fast attack (5 ms) and smooth release (80 ms) control peaks without pumping, while
     * progressively trimming sub-bass below 55 Hz as boost increases so factory bass stays tight.
     */
    data class MbcBand(
        val cutoffHz: Double,
        val attackMs: Double = 5.0,
        val releaseMs: Double = 80.0,
        val ratio: Double = 1.4,
        val thresholdDb: Double = -12.0,
        val kneeWidthDb: Double = 6.0,
        val noiseGateThresholdDb: Double = -90.0,
        val expanderRatio: Double = 1.0,
        val preGainDb: Double = 0.0,
        val postGainDb: Double = 0.0,
    )

    data class MbcParams(
        val enabled: Boolean,
        val bands: List<MbcBand>,
    )

    /**
     * Stage 2 transparent soft-knee brickwall peak limiter: reacts in 1 ms, releases in 60 ms,
     * limits at 10:1 above -0.5 dBFS so high boost levels remain loud without digital clipping.
     */
    data class LimiterParams(
        val enabled: Boolean,
        val attackMs: Double = 1.0,
        val releaseMs: Double = 60.0,
        val ratio: Double = 10.0,
        val thresholdDb: Double = -0.5,
        val postGainDb: Double = 0.0,
    )

    data class Plan(
        val bands: List<Band>,
        /** Preamp + boost, applied before the EQ bands. */
        val inputGainDb: Double,
        val limiter: LimiterParams,
        val sampleRate: Int,
        val mbc: MbcParams = MbcParams(enabled = false, bands = emptyList()),
    ) {
        val bandCount: Int get() = bands.size
    }

    /**
     * Build a [Plan]. [boostDb] is used as given; callers clamp it with [Headroom.clampBoost]
     * first (the repository does), this layer stays pure.
     */
    fun plan(
        bands: List<ParametricBand>,
        preampDb: Double,
        boostDb: Double,
        limiterEnabled: Boolean,
        bandCount: Int = DEFAULT_BAND_COUNT,
        sampleRate: Int = DEFAULT_SAMPLE_RATE,
    ): Plan {
        require(bandCount >= 1) { "bandCount must be >= 1" }
        val response = EqResponse(bands, preampDb = 0.0, sampleRate = sampleRate.toDouble())
        val edges = bandEdges(bandCount)
        val planned = ArrayList<Band>(bandCount)
        for (i in 0 until bandCount) {
            val lower = edges[i]
            val upper = edges[i + 1]
            val centre = sqrt(lower * upper)
            planned += Band(cutoffHz = upper, gainDb = response.bandsOnlyDb(centre))
        }
        val mbc = planMbcForBoost(boostDb)
        return Plan(
            bands = planned,
            inputGainDb = preampDb + boostDb,
            mbc = mbc,
            limiter = LimiterParams(enabled = limiterEnabled),
            sampleRate = sampleRate,
        )
    }

    /**
     * Stage 1 loudness compression + progressive < 55 Hz sub-bass trim so heavy earbud factory
     * bass stays controlled when upward loudness gain is applied.
     */
    fun planMbcForBoost(boostDb: Double): MbcParams {
        if (boostDb <= 0.05) {
            return MbcParams(enabled = false, bands = emptyList())
        }
        val norm = (boostDb / TuningSettings.MAX_BOOST_DB).coerceIn(0.0, 1.0)
        val subBassTrimDb = -4.5 * norm
        val midBassTrimDb = -1.0 * norm
        return MbcParams(
            enabled = true,
            bands = listOf(
                MbcBand(
                    cutoffHz = SUB_BASS_CUTOFF_HZ,
                    attackMs = 5.0,
                    releaseMs = 80.0,
                    ratio = 1.8 + 0.8 * norm,
                    thresholdDb = -14.0 - boostDb * 0.5,
                    kneeWidthDb = 6.0,
                    preGainDb = subBassTrimDb,
                ),
                MbcBand(
                    cutoffHz = 250.0,
                    attackMs = 5.0,
                    releaseMs = 80.0,
                    ratio = 1.35 + 0.65 * norm,
                    thresholdDb = -12.0 - boostDb * 0.45,
                    kneeWidthDb = 6.0,
                    preGainDb = midBassTrimDb,
                ),
                MbcBand(
                    cutoffHz = 2000.0,
                    attackMs = 5.0,
                    releaseMs = 80.0,
                    ratio = 1.25 + 0.55 * norm,
                    thresholdDb = -11.0 - boostDb * 0.45,
                    kneeWidthDb = 6.0,
                    preGainDb = 0.0,
                ),
                MbcBand(
                    cutoffHz = MAX_FREQ_HZ,
                    attackMs = 5.0,
                    releaseMs = 80.0,
                    ratio = 1.2 + 0.5 * norm,
                    thresholdDb = -10.0 - boostDb * 0.4,
                    kneeWidthDb = 6.0,
                    preGainDb = 0.0,
                ),
            ),
        )
    }

    /**
     * `bandCount + 1` log-spaced edges from [MIN_FREQ_HZ] to [MAX_FREQ_HZ]. Band `i` spans
     * `edges[i]..edges[i+1]`; its cutoff reported to Android is `edges[i+1]`.
     */
    fun bandEdges(bandCount: Int): DoubleArray {
        val ratio = MAX_FREQ_HZ / MIN_FREQ_HZ
        return DoubleArray(bandCount + 1) { i -> MIN_FREQ_HZ * ratio.pow(i.toDouble() / bandCount) }
    }

    /** Geometric centre of band [index] for a [bandCount]-band plan; handy for tests and the UI. */
    fun bandCentreHz(index: Int, bandCount: Int): Double {
        val edges = bandEdges(bandCount)
        return sqrt(edges[index] * edges[index + 1])
    }
}
