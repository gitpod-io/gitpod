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

class ExtendWorkspaceTimeoutAction : AnAction() {
    private val manager = service<GitpodManager>()

    override fun actionPerformed(event: AnActionEvent) {
        manager.pendingInfo.thenAccept { workspaceInfo ->
            manager.trackEvent("jb_execute_command_gitpod_workspace", mapOf(
                "action" to "extend-timeout"
            ))

            manager.client.server.setWorkspaceTimeout(workspaceInfo.workspaceId, WorkspaceTimeoutDuration.DURATION_180M.toString()).whenComplete { result, e ->
                var message: String
                var notificationType: NotificationType

                if (e != null) {
                    message = "Cannot extend workspace timeout: ${e.message}"
                    notificationType = NotificationType.ERROR
                    thisLogger().error("gitpod: failed to extend workspace timeout", e)
                } else {
                    if (result.resetTimeoutOnWorkspaces.isNotEmpty()) {
                        message = "Workspace timeout extended to 180 minutes. This reset the workspace timeout for other workspaces."
                        notificationType = NotificationType.WARNING
                    } else {
                        message = "Workspace timeout extended to 180 minutes."
                        notificationType = NotificationType.INFORMATION
                    }
                }

                val notification = manager.notificationGroup.createNotification(message, notificationType)
                notification.notify(null)
            }
        }
    }
}
