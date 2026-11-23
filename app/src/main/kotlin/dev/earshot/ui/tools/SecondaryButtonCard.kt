package dev.earshot.ui.tools

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dev.earshot.R
import dev.earshot.core.ButtonAction
import dev.earshot.core.ButtonAssignment
import dev.earshot.shortcut.AssistantCandidate
import dev.earshot.shortcut.ShortcutAction
import dev.earshot.shortcut.ShortcutButtonPolicy
import dev.earshot.ui.common.SectionCard

/**
 * "Shortcut Button 2 (left earbud):" and so on: a Bose `[1.9]` record after the first.
 * Offers the exact same independent action menu as Shortcut Button 1 (Cycle Listening Modes,
 * Immersive Audio, Cycle EQ Preset, Voice Assistant, Launch an App..., Off).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SecondaryButtonCard(
    button: ButtonAssignment,
    index: Int,
    selectedAction: ShortcutAction,
    earbuds: Boolean,
    autoAssistant: AssistantCandidate? = null,
    onSelectAction: (ShortcutAction) -> Unit,
    onPickApp: () -> Unit = {},
    onPickAssistant: () -> Unit = {},
) {
    val selected = selectedAction.choice()
    val nativeModes = ShortcutButtonPolicy.nativeOptions(button.supportedActions)
    val options = ShortcutChoice.options(nativeModes, selected, earbuds = earbuds)
    var expanded by remember { mutableStateOf(false) }

    SectionCard {
        Text(buttonTitle(button, index), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(bottom = 8.dp))
        ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
            OutlinedTextField(
                value = choiceLabel(selected, earbuds),
                onValueChange = {},
                readOnly = true,
                singleLine = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
            )
            ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEachIndexed { i, option ->
                    if (!earbuds && option.isNative && (i == 0 || !options[i - 1].isNative)) HorizontalDivider()
                    DropdownMenuItem(
                        text = { Text(choiceLabel(option, earbuds)) },
                        onClick = {
                            expanded = false
                            when (option) {
                                ShortcutChoice.CYCLE_LISTENING_MODES -> onSelectAction(ShortcutAction.CycleModes)
                                ShortcutChoice.PHONE_ASSISTANT -> onSelectAction(
                                    selectedAction as? ShortcutAction.OpenAssistant ?: ShortcutAction.OpenAssistant(),
                                )
                                ShortcutChoice.CYCLE_EQ -> onSelectAction(ShortcutAction.CycleEq)
                                ShortcutChoice.VOICE_MEMO -> onSelectAction(ShortcutAction.VoiceMemo)
                                ShortcutChoice.LAUNCH_APP -> onPickApp()
                                ShortcutChoice.IMMERSIVE_AUDIO ->
                                    onSelectAction(ShortcutAction.HeadphoneButton(ButtonAction.SPATIAL_AUDIO.storedId))
                                ShortcutChoice.OFF ->
                                    onSelectAction(ShortcutAction.HeadphoneButton(ButtonAction.DISABLED.storedId))
                            }
                        },
                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                    )
                }
            }
        }
        when (selectedAction) {
            is ShortcutAction.LaunchApp -> {
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    val icon = rememberAppIcon(selectedAction.packageName)
                    if (icon != null) {
                        Image(icon, contentDescription = null, modifier = Modifier.size(32.dp))
                    } else {
                        Icon(Icons.Default.Apps, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(32.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Text(
                        selectedAction.label ?: selectedAction.packageName ?: stringResource(R.string.shortcut_no_app_chosen),
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = onPickApp) { Text(stringResource(R.string.shortcut_change)) }
                }
            }
            is ShortcutAction.OpenAssistant -> {
                Row(
                    Modifier.fillMaxWidth().padding(top = 8.dp).defaultMinSize(minHeight = 48.dp).clickable(onClick = onPickAssistant).padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.shortcut_assistant_row, assistantLabel(selectedAction, autoAssistant)),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            else -> Unit
        }
        Text(
            stringResource(R.string.shortcut_secondary_hint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp, start = 4.dp, end = 4.dp),
        )
    }
}
