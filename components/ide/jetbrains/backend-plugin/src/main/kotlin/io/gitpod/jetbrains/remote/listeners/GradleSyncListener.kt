// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.listeners

import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.externalSystem.model.task.ExternalSystemTaskId
import com.intellij.openapi.externalSystem.model.task.ExternalSystemTaskNotificationListener
import com.intellij.openapi.externalSystem.model.task.ExternalSystemTaskType
import java.io.File

class GradleSyncListener : ExternalSystemTaskNotificationListener {
    override fun onStart(id: ExternalSystemTaskId, workingDir: String?) {
        if (id.projectSystemId.toString() != "GRADLE" || id.type != ExternalSystemTaskType.RESOLVE_PROJECT) {
            return
        }
        val lockFile = File("/tmp/gitpod-gradle.lock")
        if (!lockFile.exists()) {
            return
        }

        val notification = Notification(
            "gitpod",
            "Gitpod: Pause gradle sync",
            "Pausing Gradle Sync, execute <code style='color: orange;'>gp jetbrains gradle resume</code> to unblock all builtin Gradle Sync",
            NotificationType.INFORMATION
        )
        var isCancelled = false
        notification.addAction(object : NotificationAction("Cancel") {
            override fun actionPerformed(e: AnActionEvent, notification: Notification) {
                isCancelled = true
                notification.expire()
            }
        })
        Notifications.Bus.notify(notification)

        while (lockFile.exists()) {
            if (isCancelled) {
                thisLogger().warn("gitpod: gradle sync pausing is cancelled")
                break
            }
            Thread.sleep(1000)
        }
        thisLogger().warn("gitpod: gradle sync pausing finished")
        ApplicationManager.getApplication().invokeLater {
            notification.expire()
        }
    }
}
