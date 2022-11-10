// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.actions

import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.util.ExceptionUtil
import io.gitpod.gitpodprotocol.api.entities.Error
import io.gitpod.gitpodprotocol.api.entities.TakeSnapshotOptions
import io.gitpod.jetbrains.remote.GitpodManager
import org.eclipse.lsp4j.jsonrpc.ResponseErrorException
import java.awt.datatransfer.StringSelection

class ShareWorkspaceSnapshotAction : AnAction() {
    private val manager = service<GitpodManager>()

    override fun actionPerformed(event: AnActionEvent) {
        manager.pendingInfo.thenAccept { workspaceInfo ->
            manager.trackEvent(
                    "jb_execute_command_gitpod_workspace", mapOf(
                    "action" to "snapshot"
                )
            )

            val takeSnapshotOptions = TakeSnapshotOptions(workspaceInfo.workspaceId, true)

            manager.client.server.takeSnapshot(takeSnapshotOptions).whenComplete { snapshotId, t ->
                if (t != null) {
                    val notification = manager.notificationGroup.createNotification(
                            "Cannot capture workspace snapshot: ${t.message}",
                            NotificationType.ERROR
                    )
                    notification.notify(null)
                    thisLogger().error("gitpod: failed to capture workspace snapshot", t)
                } else {
                    thisLogger().warn("gitpod: snapshot started ($snapshotId)")
                    val notification = manager.notificationGroup.createNotification(
                            "Capturing workspace snapshot: this might take a moment, you will get a notification when the snapshot is ready",
                            NotificationType.INFORMATION
                    )
                    notification.notify(null)

                    manager.client.server.waitForSnapshot(snapshotId).whenComplete { _, t ->
                        if (t != null) {
                            val error = ExceptionUtil.findCause(t, ResponseErrorException::class.java)
                            if (error.responseError.code == Error.SNAPSHOT_ERROR.errCode || error.responseError.code == Error.NOT_FOUND.errCode) {
                                // this is indeed an error with snapshot creation itself, break here!
                                throw t
                            }
                        }
                        val notification = manager.notificationGroup.createNotification(
                                "The current state is captured in a snapshot. Using this link anybody can create their own copy of this workspace.",
                                NotificationType.INFORMATION
                        )
                        val copyUrlAction = NotificationAction.createSimple("Copy URL to Clipboard") {
                            val uri = "${workspaceInfo.gitpodHost}#snapshot/$snapshotId";
                            CopyPasteManager.getInstance().setContents(StringSelection(uri))
                        }
                        notification.addAction(copyUrlAction)
                        notification.notify(null)
                    }
                }
            }
        }
    }
}
