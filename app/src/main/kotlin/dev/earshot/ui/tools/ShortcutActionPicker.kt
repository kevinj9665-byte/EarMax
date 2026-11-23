package dev.earshot.ui.tools

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.earshot.R
import dev.earshot.core.ButtonAction
import dev.earshot.shortcut.AssistantCandidate
import dev.earshot.shortcut.ShortcutAction

/** The entries of both Right and Left earbud shortcut dropdowns. */
internal enum class ShortcutChoice(val isNative: Boolean = false) {
    CYCLE_LISTENING_MODES,
    PHONE_ASSISTANT,
    CYCLE_EQ,
    VOICE_MEMO,
    LAUNCH_APP,
    /** `[1.9]` mode 19 on the headphones themselves. */
    IMMERSIVE_AUDIO(isNative = true),
    /** `[1.9]` mode 14 (Disabled). */
    OFF(isNative = true),
    ;

    companion object {
        /** Earshot's own actions, in display order. */
        val EARSHOT = listOf(CYCLE_LISTENING_MODES, CYCLE_EQ, PHONE_ASSISTANT, LAUNCH_APP)

        /** Earbuds offer the 6 options specified for Left & Right tap-and-hold customization. */
        val EARBUDS_OPTIONS = listOf(
            CYCLE_LISTENING_MODES,
            IMMERSIVE_AUDIO,
            CYCLE_EQ,
            PHONE_ASSISTANT,
            LAUNCH_APP,
            OFF,
        )

        fun forNative(mode: ButtonAction): ShortcutChoice? = when (mode) {
            ButtonAction.SPATIAL_AUDIO -> IMMERSIVE_AUDIO
            ButtonAction.DISABLED -> OFF
            ButtonAction.MODES_CAROUSEL -> CYCLE_LISTENING_MODES
            else -> null
        }

        /**
         * The dropdown's options for a shortcut button.
         * - When [earbuds] is true, offers the 6 earbud hold options (`Cycle Listening Modes`,
         *   `Immersive Audio`, `Cycle EQ Preset`, `Voice Assistant`, `Launch an App…`, `Off`).
         * - Otherwise, offers Earshot's actions + [nativeModes] reported by the headset.
         * The current choice is always listed.
         */
        fun options(nativeModes: List<ButtonAction>, current: ShortcutChoice, earbuds: Boolean = false): List<ShortcutChoice> {
            val list = if (earbuds) {
                EARBUDS_OPTIONS
            } else {
                listOf(CYCLE_LISTENING_MODES, PHONE_ASSISTANT, CYCLE_EQ, VOICE_MEMO, LAUNCH_APP) +
                    nativeModes.mapNotNull(::forNative).filterNot { it == CYCLE_LISTENING_MODES }
            }
            return if (current in list) list else list + current
        }
    }
}

internal fun ShortcutAction.choice(): ShortcutChoice = when (this) {
    ShortcutAction.CycleModes -> ShortcutChoice.CYCLE_LISTENING_MODES
    is ShortcutAction.OpenAssistant -> ShortcutChoice.PHONE_ASSISTANT
    ShortcutAction.CycleEq -> ShortcutChoice.CYCLE_EQ
    ShortcutAction.VoiceMemo -> ShortcutChoice.VOICE_MEMO
    is ShortcutAction.LaunchApp -> ShortcutChoice.LAUNCH_APP
    // An unknown stored mode behaves like the assistant (see ShortcutEngine), so it reads as one.
    is ShortcutAction.HeadphoneButton -> ShortcutChoice.forNative(ButtonAction.fromStoredId(mode)) ?: ShortcutChoice.PHONE_ASSISTANT
}

@Composable
internal fun choiceLabel(choice: ShortcutChoice, earbuds: Boolean): String = stringResource(
    when (choice) {
        ShortcutChoice.CYCLE_LISTENING_MODES -> R.string.shortcut_choice_cycle_modes
        ShortcutChoice.PHONE_ASSISTANT -> R.string.shortcut_choice_assistant
        ShortcutChoice.CYCLE_EQ -> R.string.shortcut_action_cycle_eq
        ShortcutChoice.VOICE_MEMO -> R.string.shortcut_action_voice_memo
        ShortcutChoice.LAUNCH_APP -> R.string.shortcut_choice_launch
        ShortcutChoice.IMMERSIVE_AUDIO -> if (earbuds) R.string.shortcut_choice_immersive_buds else R.string.shortcut_choice_immersive
        ShortcutChoice.OFF -> R.string.shortcut_choice_off
    },
)

/** One line for the current choice, e.g. "Cycle EQ preset" or "Open Spotify" (the Tools row). */
@Composable
internal fun shortcutSummary(action: ShortcutAction, earbuds: Boolean): String =
    (action as? ShortcutAction.LaunchApp)?.label?.let { stringResource(R.string.shortcut_action_launch_named, it) }
        ?: choiceLabel(action.choice(), earbuds)

/** "Automatic (Google)" or the picked assistant's name. */
@Composable
internal fun assistantLabel(action: ShortcutAction.OpenAssistant, autoAssistant: AssistantCandidate?): String =
    action.label ?: autoAssistant?.let { stringResource(R.string.shortcut_assistant_auto_named, it.label) }
        ?: stringResource(R.string.shortcut_assistant_auto)

@Composable
internal fun AssistantDialog(
    current: String?,
    assistants: List<AssistantCandidate>,
    autoAssistant: AssistantCandidate?,
    onPick: (AssistantCandidate?) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.shortcut_pick_assistant)) },
        text = {
            LazyColumn(Modifier.heightIn(max = 420.dp)) {
                item {
                    ChoiceRow(
                        stringResource(R.string.shortcut_assistant_auto),
                        autoAssistant?.let { stringResource(R.string.shortcut_assistant_auto_now, it.label) }
                            ?: stringResource(R.string.shortcut_assistant_none_found),
                        selected = current == null,
                    ) { onPick(null) }
                }
                items(assistants, key = { it.component }) { candidate ->
                    ChoiceRow(
                        candidate.label,
                        stringResource(
                            if (candidate.kind == AssistantCandidate.Kind.VOICE_COMMAND) R.string.shortcut_assistant_kind_command
                            else R.string.shortcut_assistant_kind_assist,
                        ),
                        selected = current == candidate.component,
                    ) { onPick(candidate) }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@Composable
private fun ChoiceRow(title: String, subtitle: String?, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = null)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            if (subtitle != null) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
