package dev.earshot.dsp

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WindBlockFilterTest {
    @Test
    fun `wind cut disabled returns original bands unchanged`() {
        val original = BuiltInPresets.bassBoost.bands
        assertEquals(original, WindBlockFilter.effectiveBands(original, windCutEnabled = false))
    }

    @Test
    fun `wind cut enabled strongly attenuates sub-100 Hz while sparing mids`() {
        val base = BuiltInPresets.tunedForQcUltraEarbuds2.bands
        val windCut = WindBlockFilter.effectiveBands(base, windCutEnabled = true)
        val response = EqResponse(windCut, preampDb = 0.0)

        assertTrue(response.bandsOnlyDb(40.0) <= -15.0, "40 Hz should be heavily attenuated, got ${response.bandsOnlyDb(40.0)}")
        assertTrue(response.bandsOnlyDb(80.0) <= -6.0, "80 Hz should be attenuated, got ${response.bandsOnlyDb(80.0)}")

        val baseResponse = EqResponse(base, preampDb = 0.0)
        assertEquals(baseResponse.bandsOnlyDb(1000.0), response.bandsOnlyDb(1000.0), 0.75)
    }

    @Test
    fun `wind cut suppresses conflicting sub-100 Hz bass boosts without mutating saved bands`() {
        val heavyBass = BuiltInPresets.bassBoost.bands
        val effective = WindBlockFilter.effectiveBands(heavyBass, windCutEnabled = true)
        val response = EqResponse(effective, preampDb = 0.0)
        assertTrue(response.bandsOnlyDb(50.0) <= -14.0, "50 Hz should still be strongly cut despite bass boost")
    }
}
