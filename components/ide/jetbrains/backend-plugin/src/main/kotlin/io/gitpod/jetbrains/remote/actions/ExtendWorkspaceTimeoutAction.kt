// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import io.gitpod.gitpodprotocol.api.entities.WorkspaceTimeoutDuration
import io.gitpod.jetbrains.remote.GitpodManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.ValidationInfo
import javax.swing.JComponent
import javax.swing.JTextField
import javax.swing.JPanel
import javax.swing.JComboBox
import javax.swing.BoxLayout

// validation from https://github.com/gitpod-io/gitpod/blob/74ccaea38db8df2d1666161a073015485ebb90ca/components/gitpod-protocol/src/gitpod-service.ts#L361-L383
const val WORKSPACE_MAXIMUM_TIMEOUT_HOURS = 24
fun validate(duration: Int, unit: Char): String {
    if (duration <= 0) {
        throw IllegalArgumentException("Invalid timeout value: ${duration}${unit}")
    }
    if (
        (unit == 'h' && duration > WORKSPACE_MAXIMUM_TIMEOUT_HOURS) ||
        (unit == 'm' && duration > WORKSPACE_MAXIMUM_TIMEOUT_HOURS * 60)
    ) {
        throw IllegalArgumentException("Workspace inactivity timeout cannot exceed 24h")
    }
    return "valid"
}

class InputDurationDialog : DialogWrapper(null, true) {
    private val textField = JTextField(10)
    private val unitComboBox = JComboBox(arrayOf("minutes", "hours"))

    init {
        init()
        title = "Set timeout duration"
    }

    override fun createCenterPanel(): JComponent {
        val customComponent = JPanel()
        customComponent.layout = BoxLayout(customComponent, BoxLayout.X_AXIS)
        customComponent.add(textField)
        customComponent.add(unitComboBox)

        textField.text = "180"

        return customComponent
    }

    override fun doValidate(): ValidationInfo? {
        try {
            val selectedUnit = unitComboBox.selectedItem.toString()
            validate(textField.text.toInt(), selectedUnit[0])
            return null
        } catch (e: IllegalArgumentException) {
            return ValidationInfo(e.message ?: "An unknown error has occurred", textField)
        }
    }

    fun getDuration(): String {
        val selectedUnit = unitComboBox.selectedItem.toString()
        return "${textField.text}${selectedUnit[0]}"
    }
}

class ExtendWorkspaceTimeoutAction : AnAction() {
    private val manager = service<GitpodManager>()

    override fun actionPerformed(event: AnActionEvent) {
        manager.pendingInfo.thenAccept { workspaceInfo ->
            manager.trackEvent("jb_execute_command_gitpod_workspace", mapOf(
                "action" to "extend-timeout"
            ))

            val dialog = InputDurationDialog()
            if (dialog.showAndGet()) {
                val duration = dialog.getDuration()
                manager.client.server.setWorkspaceTimeout(workspaceInfo.workspaceId, duration.toString()).whenComplete { result, e ->
                    var message: String
                    var notificationType: NotificationType

                    if (e != null) {
                        message = "Cannot extend workspace timeout: ${e.message}"
                        notificationType = NotificationType.ERROR
                        thisLogger().error("gitpod: failed to extend workspace timeout", e)
                    } else {
                        message = "Workspace timeout has been extended to ${result.humanReadableDuration}."
                        notificationType = NotificationType.INFORMATION
                    }

                    val notification = manager.notificationGroup.createNotification(message, notificationType)
                    notification.notify(null)
                }
            }
        }
    }
}
