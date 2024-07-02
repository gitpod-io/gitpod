// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import com.jetbrains.rd.util.ConcurrentHashMap
import com.jetbrains.rd.util.URI
import com.jetbrains.toolbox.gateway.ssh.SshConnectionInfo
import io.gitpod.publicapi.v1.WorkspaceOuterClass
import io.gitpod.toolbox.auth.GitpodAuthManager
import kotlinx.serialization.Serializable

class GitpodConnectionProvider(
    private val authManager: GitpodAuthManager,
    private val workspaceId: String,
    private val publicApi: GitpodPublicApiManager,
) {
    private val activeConnections = ConcurrentHashMap<String, Boolean>()

    suspend fun connect(): Pair<SshConnectionInfo, () -> Unit> {
        val workspace = publicApi.getWorkspace(workspaceId).workspace
        val ownerTokenResp = publicApi.getWorkspaceOwnerToken(workspaceId)
        val account = authManager.getCurrentAccount() ?: throw Exception("No account found")

        // TODO: debug workspace
        val connectParams = ConnectParams(account.getHost(), workspaceId, false)

        val (serverPort, cancel) = tunnelWithWebSocket(workspace, connectParams, ownerTokenResp.ownerToken)

        val connInfo = GitpodWebSocketSshConnectionInfo(
            "gitpod",
            "localhost",
            serverPort,
        )
        return (connInfo to cancel)
    }

    private fun tunnelWithWebSocket(
        workspace: WorkspaceOuterClass.Workspace,
        connectParams: ConnectParams,
        ownerToken: String,
    ): Pair<Int, () -> Unit> {
        val connectionKeyId = connectParams.uniqueID

        var found = true
        activeConnections.computeIfAbsent(connectionKeyId) {
            found = false
            true
        }

        if (found) {
            val errMessage = "A connection to the same workspace already exists: $connectionKeyId"
            throw IllegalStateException(errMessage)
        }

        val workspaceHost = URI.create(workspace.status.workspaceUrl).host
        val server =
            GitpodWebSocketTunnelServer("wss://${workspaceHost}/_supervisor/tunnel/ssh", ownerToken)

        val cancelServer = server.start()

        return (server.port to {
            activeConnections.remove(connectionKeyId)
            cancelServer()
        })
    }
}

class GitpodWebSocketSshConnectionInfo(
    private val username: String,
    private val host: String,
    private val port: Int,
) : SshConnectionInfo {
    override fun getHost() = host
    override fun getPort() = port
    override fun getUserName() = username
    override fun getShouldAskForPassword() = false
    override fun getShouldUseSystemSshAgent() = true
}

data class ConnectParams(
    val gitpodHost: String,
    val workspaceId: String,
    val debugWorkspace: Boolean = false,
) {
    val resolvedWorkspaceId = "${if (debugWorkspace) "debug-" else ""}$workspaceId"
    val title = "$resolvedWorkspaceId ($gitpodHost)"
    val uniqueID = "$gitpodHost-$workspaceId-$debugWorkspace"
}

@Serializable
private data class SSHPublicKey(
    val type: String,
    val value: String
)
