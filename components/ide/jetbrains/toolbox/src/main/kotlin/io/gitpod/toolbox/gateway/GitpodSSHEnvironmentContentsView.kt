package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.environments.ManualEnvironmentContentsView
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.okio.decodeFromBufferedSource
import com.jetbrains.toolbox.gateway.environments.SshEnvironmentContentsView
import com.jetbrains.toolbox.gateway.ssh.SshConnectionInfo
import io.gitpod.toolbox.data.GitpodPublicApiManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlin.coroutines.coroutineContext
import java.util.concurrent.CompletableFuture
import kotlinx.coroutines.future.*
import kotlinx.coroutines.*
import org.slf4j.Logger
import java.net.URI
import java.net.URL
import okhttp3.Request
import java.time.Duration
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import okio.Buffer

class GitpodWorkspaceSshConnectionInfo(private val username: String, private val host: String, private val sshKey: ByteArray) : SshConnectionInfo {
    override fun getHost(): String {
        return host
    }

    override fun getPort(): Int {
        return 22;
    }

    override fun getUserName(): String? {
        return username
    }

    override fun getShouldAskForPassword(): Boolean {
        return false
    }
    override fun getShouldUseSystemSshAgent(): Boolean {
        return false
    }

    override fun getPrivateKeys(): MutableList<ByteArray>? {
        return arrayListOf(sshKey)
    }
}

class GitpodSSHEnvironmentContentsView(
        private val workspaceId: String,
        private val publicApi: GitpodPublicApiManager,
        private val httpClient: OkHttpClient,
        private val coroutineScope: CoroutineScope,
        private val logger: Logger
) : SshEnvironmentContentsView, ManualEnvironmentContentsView {
    override fun getConnectionInfo(): CompletableFuture<SshConnectionInfo> {
        return coroutineScope.future {
            val workspaceResp = publicApi.getWorkspace(workspaceId)
            val ownerTokenResp = publicApi.getWorkspaceOwnerToken(workspaceId)

            // TODO: take into account debug- workspaces
            var actualWorkspaceUrl = URL(workspaceResp.workspace.status.workspaceUrl)

            val workspaceHost = actualWorkspaceUrl.host.substring(actualWorkspaceUrl.host.indexOf('.') + 1)
            val workspaceSSHHost = "${workspaceId}.ssh.${workspaceHost}"

            val sshResp = createSSHKeyPair(actualWorkspaceUrl, ConnectParams("https://gitpod.io", workspaceId), ownerTokenResp.ownerToken)
            if (sshResp == null) {
                throw Exception("Couldn't generate sshkeypair")
            }

            return@future GitpodWorkspaceSshConnectionInfo(workspaceId, workspaceSSHHost, sshResp.privateKey.toByteArray(Charsets.UTF_8))
        }
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
//                readTimeout(Duration.ofMillis(requestTimeout))

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

    override fun addEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
    }

    override fun removeEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
    }
}

data class ConnectParams(
        val gitpodHost: String,
        val actualWorkspaceId: String,
        val debugWorkspace: Boolean = false,
) {
    val resolvedWorkspaceId = "${if (debugWorkspace) "debug-" else ""}$actualWorkspaceId"
    val title = "$resolvedWorkspaceId ($gitpodHost)"
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