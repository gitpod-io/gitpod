// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.actions

import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.ide.CopyPasteManager
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PerClientPortForwardingManager
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PortConfiguration
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PortForwardingDataKeys
import io.gitpod.jetbrains.remote.AbstractGitpodPortForwardingService
import java.awt.datatransfer.StringSelection

@Suppress("ComponentNotRegistered", "UnstableApiUsage")
class GitpodCopyWebUrlAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.dataContext.getData(PortForwardingDataKeys.SUGGESTION)?.getSuggestedHostPort()?.let { hostPort ->
            (service<PerClientPortForwardingManager>().getPorts(hostPort).firstOrNull {
                it.labels.contains(AbstractGitpodPortForwardingService.EXPOSED_PORT_LABEL)
            }?.configuration as PortConfiguration.UrlExposure?)?.exposedUrl?.let {
                CopyPasteManager.getInstance().setContents(StringSelection(it))
            }
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = (e.place != ActionPlaces.ACTION_SEARCH)
    }

    override fun getActionUpdateThread() = ActionUpdateThread.BGT
}
