// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import com.jetbrains.rd.util.ConcurrentHashMap
import com.jetbrains.toolbox.gateway.ssh.SshConnectionInfo

interface ConnectionInfoProvider {
    fun getUniqueID(): String
    suspend fun getWebsocketTunnelUrl(): String
    suspend fun getOwnerToken(): String
}

class GitpodConnectionProvider(private val provider: ConnectionInfoProvider) {
    private val activeConnections = ConcurrentHashMap<String, Boolean>()

    fun connect(): Pair<SshConnectionInfo, () -> Unit> {
        val (serverPort, cancel) = tunnelWithWebSocket(provider)

        val connInfo = GitpodWebSocketSshConnectionInfo(
            "gitpod",
            "localhost",
            serverPort,
        )
        return (connInfo to cancel)
    }

    private fun tunnelWithWebSocket(provider: ConnectionInfoProvider): Pair<Int, () -> Unit> {
        val connectionKeyId = provider.getUniqueID()

        var found = true
        activeConnections.computeIfAbsent(connectionKeyId) {
            found = false
            true
        }

        if (found) {
            val errMessage = "A connection to the same workspace already exists: $connectionKeyId"
            throw IllegalStateException(errMessage)
        }

        val server = GitpodWebSocketTunnelServer(provider)

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
    val workspaceId: String,
    val host: String,
    val debugWorkspace: Boolean = false,
) {
    val uniqueID = if (debugWorkspace) "debug-$workspaceId" else workspaceId
}
