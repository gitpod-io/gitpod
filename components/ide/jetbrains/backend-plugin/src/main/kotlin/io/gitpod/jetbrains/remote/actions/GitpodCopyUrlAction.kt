// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.actions

import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ide.CopyPasteManager
import com.jetbrains.rd.platform.codeWithMe.portForwarding.ClientPortState
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PortConfiguration
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PortForwardingDataKeys
import org.apache.http.client.utils.URIBuilder
import java.awt.datatransfer.StringSelection

@Suppress("ComponentNotRegistered", "UnstableApiUsage")
class GitpodCopyUrlAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        (e.dataContext.getData(PortForwardingDataKeys.PORT)
                ?.configuration as PortConfiguration.PerClientTcpForwarding?)
                ?.clientPortState?.let {
                    if (it is ClientPortState.Assigned) {
                        CopyPasteManager.getInstance().setContents(StringSelection(
                                URIBuilder()
                                        .setScheme("http")
                                        .setHost(it.clientInterface)
                                        .setPort(it.clientPort)
                                        .build()
                                        .toString())
                        )
                    }
                }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = (e.place != ActionPlaces.ACTION_SEARCH)
    }

    override fun getActionUpdateThread() = ActionUpdateThread.BGT
}
