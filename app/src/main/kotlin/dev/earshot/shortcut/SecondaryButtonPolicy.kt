package dev.earshot.shortcut

import dev.earshot.core.ButtonAction
import dev.earshot.core.ButtonAssignment

/**
 * Bose `[1.9]` records after the first ("Shortcut Button 2", …; earbuds report one per bud).
 * Pure, like [ShortcutButtonPolicy], which still owns Shortcut Button 1.
 *
 * Every button on Voice assistant sends the same HFP `AT+BVRA`, so the phone can't tell them
 * apart: a second button can only *share* Shortcut Button 1's Earshot action (Voice assistant)
 * or do one of the headphones' own modes. Nothing is written for a button the user never set.
 */
object SecondaryButtonPolicy {
    /** What a secondary button can be set to, in display order: shared Earshot action, then the native modes. */
    val MODES: List<ButtonAction> = listOf(ButtonAction.VOICE_ASSISTANT) + ShortcutButtonPolicy.NATIVE_MODES

    /** All hardware modes valid for a secondary button (including native mode cycling). */
    val ALL_MODES: List<ButtonAction> = MODES + ButtonAction.MODES_CAROUSEL

    /** The options [button] offers (only modes it reports). */
    fun options(button: ButtonAssignment): List<ButtonAction> = MODES.filter { it in button.supportedActions }

    /** The mode the saved [choice] asks for, when [button] supports it. */
    fun desiredMode(choice: ButtonChoice?, button: ButtonAssignment): ButtonAction? =
        choice?.let { ButtonAction.fromStoredId(it.mode) }?.takeIf { it in ALL_MODES && it in button.supportedActions }

    /** The `[1.9]` hardware mode needed for a full [ShortcutAction] on a secondary button. */
    fun desiredMode(action: ShortcutAction, button: ButtonAssignment): ButtonAction? =
        ShortcutButtonPolicy.desiredMode(action, button.supportedActions)

    /** The write [choice] needs right now, or null (no choice, unsupported, or already there). */
    fun writeFor(choice: ButtonChoice?, button: ButtonAssignment): ButtonAction? = desiredMode(choice, button)?.takeIf { it != button.action }

    /** The write [action] needs right now on [button], or null. */
    fun writeFor(action: ShortcutAction, button: ButtonAssignment): ButtonAction? = desiredMode(action, button)?.takeIf { it != button.action }

    /** What the row shows: the saved choice when valid, else what the button does now. */
    fun displayed(choice: ButtonChoice?, button: ButtonAssignment): ButtonAction = desiredMode(choice, button) ?: button.action

    /** Resolves the independent [ShortcutAction] displayed for a secondary bud/button. */
    fun displayedAction(settings: ShortcutSettings, address: String?, button: ButtonAssignment): ShortcutAction {
        settings.buttonActionFor(address, button.buttonId)?.let { return it }
        settings.buttonChoiceFor(address, button.buttonId)?.let { choice ->
            val mode = ButtonAction.fromStoredId(choice.mode)
            return when (mode) {
                ButtonAction.MODES_CAROUSEL -> ShortcutAction.CycleModes
                ButtonAction.SPATIAL_AUDIO, ButtonAction.DISABLED -> ShortcutAction.HeadphoneButton(mode.storedId)
                ButtonAction.VOICE_ASSISTANT -> ShortcutAction.OpenAssistant()
                else -> actionFromHardware(button.action)
            }
        }
        return actionFromHardware(button.action)
    }

    fun hardwareModeFor(action: ShortcutAction, button: ButtonAssignment): ButtonAction =
        desiredMode(action, button) ?: when (action) {
            is ShortcutAction.HeadphoneButton -> ButtonAction.fromStoredId(action.mode)
            ShortcutAction.CycleModes -> ButtonAction.MODES_CAROUSEL
            else -> ButtonAction.VOICE_ASSISTANT
        }

    private fun actionFromHardware(hw: ButtonAction): ShortcutAction = when (hw) {
        ButtonAction.MODES_CAROUSEL -> ShortcutAction.CycleModes
        ButtonAction.SPATIAL_AUDIO -> ShortcutAction.HeadphoneButton(ButtonAction.SPATIAL_AUDIO.storedId)
        ButtonAction.DISABLED -> ShortcutAction.HeadphoneButton(ButtonAction.DISABLED.storedId)
        else -> ShortcutAction.OpenAssistant()
    }

    /** Two or more buttons on Voice assistant: they all run the same Earshot action. */
    fun sharesAssistant(buttons: List<ButtonAssignment>): Boolean = buttons.count { it.action == ButtonAction.VOICE_ASSISTANT } >= 2

    /** "right earbud" / "left earbud" for the bud records, null for the rest. */
    fun side(buttonId: Int): Side? = when (buttonId) {
        RIGHT_SHORTCUT -> Side.RIGHT
        LEFT_SHORTCUT -> Side.LEFT
        else -> null
    }

    enum class Side { RIGHT, LEFT }

    /** `ButtonId` RIGHT_SHORTCUT / LEFT_SHORTCUT in `:protocol`. */
    const val RIGHT_SHORTCUT = 0x03
    const val LEFT_SHORTCUT = 0x04
}
