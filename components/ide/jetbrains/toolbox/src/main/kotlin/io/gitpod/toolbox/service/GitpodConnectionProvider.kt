package io.gitpod.toolbox.service


import com.jetbrains.rd.util.ConcurrentHashMap
import com.jetbrains.rd.util.URI
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.lifetime.LifetimeDefinition
import com.jetbrains.toolbox.gateway.ssh.SshConnectionInfo
import io.gitpod.publicapi.v1.WorkspaceOuterClass
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.gateway.await
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.okio.decodeFromBufferedSource
import okhttp3.OkHttpClient
import okhttp3.Request
import okio.Buffer
import org.slf4j.LoggerFactory
import java.net.URL
import kotlin.coroutines.coroutineContext

class GitpodConnectionProvider(
    private val authManager: GitpodAuthManager,
    private val workspaceId: String,
    private val publicApi: GitpodPublicApiManager,
    private val httpClient: OkHttpClient,
) {
    private val activeConnections = ConcurrentHashMap<String, LifetimeDefinition>()
    private val logger = LoggerFactory.getLogger(javaClass)

    suspend fun connect(): Pair<SshConnectionInfo, () -> Unit> {
        val workspace = publicApi.getWorkspace(workspaceId).workspace
        val ownerTokenResp = publicApi.getWorkspaceOwnerToken(workspaceId)
        val actualWorkspaceUrl = URL(workspace.status.workspaceUrl)
        val account = authManager.getCurrentAccount() ?: throw Exception("No account found")
        val sshResp = createSSHKeyPair(
            actualWorkspaceUrl,
            ConnectParams(account.getHost(), workspaceId),
            ownerTokenResp.ownerToken
        )
            ?: throw Exception("Couldn't generate sshkeypair")

        // TODO: debug workspace
        val connectParams = ConnectParams(account.getHost(), workspaceId, false)

        val (serverPort, cancel) = tunnelWithWebSocket(workspace, connectParams, ownerTokenResp.ownerToken)

        val connInfo = GitpodWorkspaceSshConnectionInfo(
            "gitpod",
            "localhost",
            serverPort,
            sshResp.privateKey.toByteArray(Charsets.UTF_8)
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
        val connectionLifetime = activeConnections.computeIfAbsent(connectionKeyId) {
            found = false
            Lifetime.Eternal.createNested()
        }

        if (found) {
            val errMessage = "A connection to the same workspace already exists: $connectionKeyId"
            throw IllegalStateException(errMessage)
        } else {
            connectionLifetime.onTermination {
                activeConnections.remove(connectionKeyId)
            }
        }

        val workspaceHost = URI.create(workspace.status.workspaceUrl).host

        val server =
            GitpodWebSocketTunnelServer("wss://${workspaceHost}/_supervisor/tunnel/ssh", ownerToken, emptyList())

        server.start(connectionLifetime)

        return (server.port to {
            connectionLifetime.terminate()
            Unit
        })
    }


    private suspend fun createSSHKeyPair(
        ideUrl: URL,
        connectParams: ConnectParams,
        ownerToken: String
    ): CreateSSHKeyPairResponse? {
        val value =
            fetchWS("https://${ideUrl.host}/_supervisor/v1/ssh_keys/create", connectParams, ownerToken)
        if (value.isNullOrBlank()) {
            return null
        }

        try {
            val source = Buffer()
            source.write(value.toByteArray(Charsets.UTF_8));
            return Json.decodeFromBufferedSource(CreateSSHKeyPairResponse.serializer(), source)
        } catch (e: Exception) {
            logger.error("Failed to sshkeypair response: ${e.message}")
            return null
        }
    }

    private suspend fun fetchWS(
        endpointUrl: String,
        connectParams: ConnectParams,
        ownerToken: String?,
    ): String? {
        val maxRequestTimeout = 30 * 1000L
        val timeoutDelayGrowFactor = 1.5
        var requestTimeout = 2 * 1000L
        while (true) {
            coroutineContext.job.ensureActive()
            try {
                var httpRequestBuilder = Request.Builder()
                    .get()
                    .url(endpointUrl)

                if (!ownerToken.isNullOrBlank()) {
                    httpRequestBuilder = httpRequestBuilder.header("x-gitpod-owner-token", ownerToken)
                }
                val httpRequest = httpRequestBuilder.build()
                val response = httpClient.newCall(httpRequest).await()
                if (response.isSuccessful) {
                    return response.body!!.string()
                }
                if (response.code < 500) {
                    logger.error("${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to fetch '$endpointUrl': ${response.code}")
                    return null
                }
                logger.warn("${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to fetch '$endpointUrl', trying again...: ${response.code}")
            } catch (t: Throwable) {
                if (t is CancellationException) {
                    throw t
                }
                logger.warn(
                    "${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to fetch '$endpointUrl', trying again...:",
                    t
                )
            }
            requestTimeout = (requestTimeout * timeoutDelayGrowFactor).toLong()
            if (requestTimeout > maxRequestTimeout) {
                requestTimeout = maxRequestTimeout
            }
        }
    }
}

class GitpodWorkspaceSshConnectionInfo(
    private val username: String,
    private val host: String,
    private val port: Int,
    private val sshKey: ByteArray
) : SshConnectionInfo {
    override fun getHost() = host
    override fun getPort() = port
    override fun getUserName() = username
    override fun getShouldAskForPassword() = false
    override fun getShouldUseSystemSshAgent() = true
    override fun getPrivateKeys() = arrayListOf(sshKey)
}

data class ConnectParams(
    val gitpodHost: String,
    val actualWorkspaceId: String,
    val debugWorkspace: Boolean = false,
) {
    val resolvedWorkspaceId = "${if (debugWorkspace) "debug-" else ""}$actualWorkspaceId"
    val title = "$resolvedWorkspaceId ($gitpodHost)"
    val uniqueID = "$gitpodHost-$actualWorkspaceId-$debugWorkspace"
}

@Serializable
private data class SSHPublicKey(
    val type: String,
    val value: String
)

@Serializable
private data class CreateSSHKeyPairResponse(
    val privateKey: String,
    val hostKey: SSHPublicKey?,
    val userName: String?
)
