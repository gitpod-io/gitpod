// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.latest

import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.util.application
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PortForwardingDataKeys
import io.gitpod.jetbrains.remote.GitpodManager
import io.gitpod.supervisor.api.Status.PortsStatusRequest
import io.gitpod.supervisor.api.StatusServiceGrpc
import kotlinx.coroutines.launch
import java.awt.datatransfer.StringSelection

@Suppress("ComponentNotRegistered", "UnstableApiUsage")
class GitpodCopyWebUrlAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.dataContext.getData(PortForwardingDataKeys.SUGGESTION)?.getSuggestedHostPort()?.let { hostPort ->
            application.coroutineScope.launch {
                getUrlFromPort(hostPort)?.let {
                    CopyPasteManager.getInstance().setContents(StringSelection(it))
                }
            }
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = (e.place != ActionPlaces.ACTION_SEARCH)
    }

    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    private fun getUrlFromPort(port: Number): String? {
        val blockingStub = StatusServiceGrpc.newBlockingStub(GitpodManager.supervisorChannel)
        val request = PortsStatusRequest.newBuilder().setObserve(false).build()
        val response = blockingStub.portsStatus(request)
        while (response.hasNext()) {
            val portStatusResponse = response.next()
            for (portStatus in portStatusResponse.portsList) {
                if (portStatus.localPort == port) return portStatus.exposed.url
            }
        }
        return null
    }
}
