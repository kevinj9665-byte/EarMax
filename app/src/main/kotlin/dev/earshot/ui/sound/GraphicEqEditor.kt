package dev.earshot.ui.sound

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.earshot.R
import dev.earshot.dsp.EqBandMode
import dev.earshot.dsp.ParametricBand
import dev.earshot.ui.common.SegmentedChoice
import kotlin.math.roundToInt

/**
 * Selectable 3-Band (Bose Style), 4-Band, 5-Band, or 7-Band graphic equaliser with clear
 * band labels, frequencies, audio role descriptions, and smooth per-mode persistence.
 */
@Composable
fun GraphicEqEditor(
    bands: List<ParametricBand>,
    preampDb: Double,
    enabled: Boolean,
    bandMode: EqBandMode = EqBandMode.BAND_5,
    bandModeGains: Map<EqBandMode, List<Double>> = emptyMap(),
    activePresetId: String? = null,
    onBandModeChange: (EqBandMode) -> Unit = {},
    onBandModeGainsChange: (EqBandMode, List<Double>) -> Unit = { _, _ -> },
    onBandsChange: (List<ParametricBand>) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val activeMatchesMode = bands.size == bandMode.bandCount && bands.map { it.frequencyHz } == bandMode.specs.map { it.frequencyHz }
    val gains: List<Double> = remember(bands, preampDb, bandMode, bandModeGains, activePresetId) {
        when {
            activeMatchesMode -> bands.map { it.gainDb.coerceIn(ParametricBand.MIN_GAIN_DB, ParametricBand.MAX_GAIN_DB) }
            activePresetId == null -> bandModeGains[bandMode]?.takeIf { it.size == bandMode.bandCount }
                ?: bandMode.sampleGainsFrom(bands)
            else -> bandMode.sampleGainsFrom(bands)
        }
    }

    Column(modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.sound_band_mode_label),
            style = MaterialTheme.typography.labelLarge,
            color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 6.dp),
        )
        SegmentedChoice(
            options = EqBandMode.entries,
            selected = bandMode,
            onSelect = onBandModeChange,
            label = { it.shortLabel },
            enabled = enabled,
        )
        if (bandMode == EqBandMode.BAND_3) {
            Text(
                stringResource(R.string.sound_band_mode_bose_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        Spacer(Modifier.height(10.dp))
        bandMode.specs.forEachIndexed { index, spec ->
            LabeledEqBandSlider(
                title = spec.label,
                frequencyText = "${formatHz(spec.frequencyHz)} Hz",
                role = spec.role,
                gainDb = gains.getOrElse(index) { 0.0 },
                enabled = enabled,
                onGainCommitted = { newGain ->
                    val next = gains.toMutableList().also { list ->
                        while (list.size < bandMode.bandCount) list.add(0.0)
                        list[index] = newGain
                    }
                    onBandModeGainsChange(bandMode, next)
                    onBandsChange(bandMode.bandsFromGains(next))
                },
            )
        }
    }
}

@Composable
private fun LabeledEqBandSlider(
    title: String,
    frequencyText: String,
    role: String,
    gainDb: Double,
    enabled: Boolean,
    onGainCommitted: (Double) -> Unit,
) {
    var drag by remember(gainDb) { mutableFloatStateOf(gainDb.toFloat()) }
    val snapped = ((drag * 2f).roundToInt() / 2.0)
    val dbText = "${formatDb(snapped, if (snapped % 1.0 == 0.0) 0 else 1)} dB"
    val semanticsDesc = "$title ($frequencyText, $role): $dbText"

    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(
                    "$title · $frequencyText",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    role,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                dbText,
                style = MaterialTheme.typography.labelLarge,
                color = when {
                    !enabled -> MaterialTheme.colorScheme.onSurfaceVariant
                    snapped != 0.0 -> MaterialTheme.colorScheme.primary
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                },
            )
        }
        Slider(
            value = drag,
            onValueChange = { drag = it },
            onValueChangeFinished = { onGainCommitted(((drag * 2f).roundToInt() / 2.0)) },
            valueRange = ParametricBand.MIN_GAIN_DB.toFloat()..ParametricBand.MAX_GAIN_DB.toFloat(),
            steps = 59,
            enabled = enabled,
            modifier = Modifier
                .fillMaxWidth()
                .semantics { stateDescription = semanticsDesc },
        )
    }
}

fun formatDb(db: Double, decimals: Int = 0): String {
    val rounded = if (decimals == 0) db.roundToInt().toDouble() else db
    val text = if (decimals == 0) rounded.roundToInt().toString() else String.format(java.util.Locale.US, "%.${decimals}f", rounded)
    return if (rounded > 0) "+$text" else text
}
