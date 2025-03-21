// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.api.remoteDev.environments.CachedIdeStub
import com.jetbrains.toolbox.api.remoteDev.environments.CachedProjectStub
import com.jetbrains.toolbox.api.remoteDev.environments.ManualEnvironmentContentsView
import com.jetbrains.toolbox.api.remoteDev.environments.SshEnvironmentContentsView
import com.jetbrains.toolbox.api.remoteDev.ssh.SshConnectionInfo
import io.gitpod.publicapi.experimental.v1.Workspaces.WorkspaceInstanceStatus
import io.gitpod.toolbox.service.*
import java.util.concurrent.CompletableFuture

class GitpodRemoteEnvironmentContentsView(
    private val connectParams: ConnectParams,
    private val publicApi: GitpodPublicApiManager,
) : SshEnvironmentContentsView, ManualEnvironmentContentsView {
    private var cancel = {}
    private val stateListeners = mutableSetOf<ManualEnvironmentContentsView.Listener>()
    private val provider = GitpodConnectionProvider(object : ConnectionInfoProvider {
        override fun getUniqueID() = connectParams.uniqueID

        override suspend fun getWebsocketTunnelUrl(): String {
            val workspace = publicApi.getWorkspace(connectParams.workspaceId)
            return workspace.getTunnelUrl()
        }

        override suspend fun getOwnerToken(): String {
            return publicApi.getWorkspaceOwnerToken(connectParams.workspaceId)
        }
    })

    private val connectionInfo = CompletableFuture.supplyAsync {
        val (connInfo, cancel) = provider.connect()
        this.cancel = cancel
        connInfo
    }

    override fun getConnectionInfo(): CompletableFuture<SshConnectionInfo> = connectionInfo

    var metadata: GitpodPublicApiManager.JoinLink2Response? = null
    suspend fun updateEnvironmentMeta(status: WorkspaceInstanceStatus) {
        if (metadata == null && status.phase == WorkspaceInstanceStatus.Phase.PHASE_RUNNING) {
            metadata = publicApi.fetchJoinLink2Info(connectParams.workspaceId, status.getIDEUrl())
        }
        if (metadata == null) {
            // TODO(hw): restore from cache?
            return
        }
        stateListeners.forEach {
            it.onProjectListUpdated(listOf(object : CachedProjectStub {
                override fun getPath() = metadata!!.projectPath
                override fun getName() = metadata!!.projectPath.split("/").last()
                override fun getIdeHint() = metadata!!.ideVersion
            }))
            it.onIdeListUpdated(listOf(object : CachedIdeStub {
                override fun getProductCode() = metadata!!.ideVersion
                override fun isRunning() = status.phase == WorkspaceInstanceStatus.Phase.PHASE_RUNNING
            }))
        }
    }

    override fun addEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
        stateListeners += p0
    }

    override fun removeEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
        stateListeners -= p0
    }

    override fun close() {
        cancel()
    }
}
