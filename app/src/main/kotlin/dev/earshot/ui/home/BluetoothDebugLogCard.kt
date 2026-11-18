package dev.earshot.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.earshot.R
import dev.earshot.bt.BtDebugLog
import dev.earshot.ui.common.SectionCard
import dev.earshot.ui.theme.legend
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Collapsible live Bluetooth debug log panel displaying raw GATT service/characteristic UUIDs,
 * RFCOMM/LE candidates, and raw BMAP hex TX/RX responses.
 */
@Composable
fun BluetoothDebugLogCard(
    entries: List<BtDebugLog.Entry>,
    onClear: () -> Unit,
    onCopy: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }

    SectionCard(modifier = modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    stringResource(R.string.bt_debug_title).legend(),
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(
                    stringResource(R.string.bt_debug_subtitle, entries.size),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(
                imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = stringResource(R.string.bt_debug_title),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        AnimatedVisibility(visible = expanded) {
            Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = onClear, enabled = entries.isNotEmpty()) {
                        Text(stringResource(R.string.action_clear))
                    }
                    TextButton(onClick = onCopy, enabled = entries.isNotEmpty()) {
                        Text(stringResource(R.string.action_copy))
                    }
                }
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.surfaceContainerLowest,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (entries.isEmpty()) {
                        Text(
                            text = stringResource(R.string.bt_debug_empty),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(12.dp),
                        )
                    } else {
                        val fmt = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
                        val scrollV = rememberScrollState()
                        val scrollH = rememberScrollState()
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 240.dp)
                                .verticalScroll(scrollV)
                                .horizontalScroll(scrollH)
                                .padding(10.dp),
                        ) {
                            entries.asReversed().forEach { e ->
                                val time = fmt.format(Date(e.timestampMs))
                                val line = buildString {
                                    append(time)
                                    append(" [")
                                    append(e.kind.name)
                                    append("] ")
                                    append(e.message)
                                    if (!e.detail.isNullOrBlank()) {
                                        append("\n    ")
                                        append(e.detail)
                                    }
                                }
                                Text(
                                    text = line,
                                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                    color = when (e.kind) {
                                        BtDebugLog.Kind.ERR -> MaterialTheme.colorScheme.error
                                        BtDebugLog.Kind.UUID, BtDebugLog.Kind.GATT -> MaterialTheme.colorScheme.primary
                                        BtDebugLog.Kind.TX -> MaterialTheme.colorScheme.tertiary
                                        else -> MaterialTheme.colorScheme.onSurface
                                    },
                                )
                                Spacer(Modifier.height(4.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}
