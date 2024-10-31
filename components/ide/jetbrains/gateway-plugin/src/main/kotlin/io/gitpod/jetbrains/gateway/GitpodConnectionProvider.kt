// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.PropertyNamingStrategies
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.ui.Messages
import com.intellij.remote.AuthType
import com.intellij.remote.RemoteCredentialsHolder
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.ssh.AskAboutHostKey
import com.intellij.ssh.OpenSshLikeHostKeyVerifier
import com.intellij.ssh.connectionBuilder
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.AlignY
import com.intellij.ui.dsl.builder.panel
import com.intellij.util.application
import com.intellij.util.io.DigestUtil
import com.intellij.util.io.delete
import com.intellij.util.net.JdkProxyProvider
import com.intellij.util.net.ssl.CertificateManager
import com.intellij.util.ui.JBFont
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import com.jetbrains.gateway.api.ConnectionRequestor
import com.jetbrains.gateway.api.GatewayConnectionHandle
import com.jetbrains.gateway.api.GatewayConnectionProvider
import com.jetbrains.gateway.ssh.SshHostTunnelConnector
import com.jetbrains.gateway.thinClientLink.ThinClientHandle
import com.jetbrains.rd.util.ConcurrentHashMap
import com.jetbrains.rd.util.URI
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.lifetime.LifetimeDefinition
import com.jetbrains.rd.util.threading.coroutines.launch
import io.gitpod.gitpodprotocol.api.entities.WorkspaceInstance
import io.gitpod.jetbrains.gateway.common.GitpodConnectionHandleFactory
import io.gitpod.jetbrains.icons.GitpodIcons
import kotlinx.coroutines.*
import kotlinx.coroutines.future.await
import java.net.URL
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.*
import javax.swing.JLabel
import kotlin.coroutines.coroutineContext
import kotlin.io.path.absolutePathString
import kotlin.io.path.writeText
import kotlin.random.Random.Default.nextInt

@Suppress("UnstableApiUsage", "OPT_IN_USAGE")
class GitpodConnectionProvider : GatewayConnectionProvider {
    private val activeConnections = ConcurrentHashMap<String, LifetimeDefinition>()
    private val gitpod = service<GitpodConnectionService>()
    private val connectionHandleFactory = service<GitpodConnectionHandleFactory>()
    private val settings = service<GitpodSettingsState>()

    private val httpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.ALWAYS)
        .build()

    private val jacksonMapper = jacksonObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)


    private fun showTimedOutDialogDialog(workspaceId: String, detail: String?) {
        val title = "Workspace Timed Out"
        val message = "Your workspace $workspaceId has timed out${if (detail.isNullOrBlank()) "" else " : $detail"}."
        val okButton = Messages.getOkButton()
        val options = arrayOf(okButton)
        val defaultIndex = 0
        val icon = Messages.getInformationIcon()
        Messages.showDialog(message, title, options, defaultIndex, icon)
    }

    override suspend fun connect(
        parameters: Map<String, String>,
        requestor: ConnectionRequestor
    ): GatewayConnectionHandle {
        if (parameters["gitpodHost"] == null) {
            throw IllegalArgumentException("bad gitpodHost parameter")
        }
        if (parameters["workspaceId"] == null) {
            throw IllegalArgumentException("bad workspaceId parameter")
        }
        val connectParams = ConnectParams(
            parameters["gitpodHost"]!!,
            parameters["workspaceId"]!!,
            parameters["backendPort"],
            parameters["debugWorkspace"] == "true"
        )

        var connectionKeyId =
            "${connectParams.gitpodHost}-${connectParams.resolvedWorkspaceId}-${connectParams.backendPort}"

        var found = true
        val connectionLifetime = activeConnections.computeIfAbsent(connectionKeyId) {
            found = false
            Lifetime.Eternal.createNested()
        }

        if (found) {
            val message =
                "You are trying to connect to a workspace that has a client already open. Check for opened JetBrains clients on your machine"
            val title = connectParams.title
            val okButton = Messages.getOkButton()
            val options = arrayOf(okButton)
            val defaultIndex = 0
            val icon = Messages.getWarningIcon()
            Messages.showDialog(message, title, options, defaultIndex, icon)

            val errMessage = "A connection to the same workspace already exists: $connectionKeyId"
            throw IllegalStateException(errMessage)
        } else {
            connectionLifetime.onTermination {
                activeConnections.remove(connectionKeyId)
            }
        }

        val client = gitpod.obtainClient(connectParams.gitpodHost)
        val updates = client.listenToWorkspace(connectionLifetime, connectParams.actualWorkspaceId)
        val workspace = client.syncWorkspace(connectParams.actualWorkspaceId).workspace

        val phaseMessage = JLabel()
        val statusMessage = JLabel()
        val errorMessage = JBTextArea().apply {
            isEditable = false
            wrapStyleWord = true
            lineWrap = true
            border = null
            font = JBFont.regular()
            emptyText.setFont(JBFont.regular())
            foreground = UIUtil.getErrorForeground()
            background = phaseMessage.background
            columns = 30
        }
        var resolvedIdeUrl = ""
        val connectionPanel = panel {
            indent {
                row {
                    resizableRow()
                    panel {
                        row {
                            icon(GitpodIcons.Logo2x).align(AlignX.CENTER)
                        }
                        row {
                            cell(phaseMessage)
                                .bold()
                                .align(AlignX.CENTER)
                        }
                        row {
                            cell(statusMessage)
                                .align(AlignX.CENTER)
                                .applyToComponent {
                                    foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                                }
                        }
                        panel {
                            row {
                                link(connectParams.resolvedWorkspaceId) {
                                    if (resolvedIdeUrl.isNotBlank()) {
                                        BrowserUtil.browse(resolvedIdeUrl)
                                    }
                                }
                            }
                            row {
                                workspace.context.normalizedContextURL.ifPresent {
                                    browserLink(it, it)
                                }
                            }
                        }.align(AlignX.CENTER)
                        row {
                            cell(JBScrollPane(errorMessage).apply {
                                border = null
                            }).align(AlignX.CENTER)
                        }
                    }.align(AlignY.CENTER)
                }
            }
        }

        fun setErrorMessage(msg: String) {
            errorMessage.text = msg
            connectionPanel.revalidate()
            connectionPanel.repaint()
        }

        GlobalScope.launch {
            var thinClient: ThinClientHandle? = null
            var thinClientJob: Job? = null

            var lastUpdate: WorkspaceInstance? = null
            var canceledByGitpod = false

            val ownerToken = client.server.getOwnerToken(connectParams.actualWorkspaceId).await()

            if (settings.additionalHeartbeat) {
                thisLogger().info("gitpod: additional heartbeat enabled for ${connectParams.resolvedWorkspaceId}")
                connectionLifetime.launch {
                    while (isActive) {
                        val delaySeconds = 30 + nextInt(5, 15)
                        if (thinClientJob?.isActive == true) {
                            try {
                                val ideUrlStr = lastUpdate?.ideUrl
                                val ideUrl = if (ideUrlStr.isNullOrBlank()) {
                                    null
                                } else {
                                    URL(ideUrlStr.replace(connectParams.actualWorkspaceId, connectParams.resolvedWorkspaceId))
                                }
                                if (lastUpdate?.status?.phase == "running" && ideUrl != null) {
                                    sendHeartBeatThroughSupervisor(ideUrl, ownerToken, connectParams)
                                }
                            } catch (t: Throwable) {
                                thisLogger().error(
                                    "gitpod: failed to send additional heartbeat for ${connectParams.resolvedWorkspaceId}",
                                    t
                                )
                            }
                        } else {
                            thisLogger().debug("gitpod: thinClient is not active, skipping additional heartbeat for ${connectParams.resolvedWorkspaceId}")
                        }
                        delay(delaySeconds * 1000L)
                    }
                }
            }

            try {
                for (update in updates) {
                    try {
                        if (WorkspaceInstance.isUpToDate(lastUpdate, update)) {
                            continue
                        }
                        resolvedIdeUrl =
                            update.ideUrl.replace(connectParams.actualWorkspaceId, connectParams.resolvedWorkspaceId)
                        lastUpdate = update
                        if (!update.status.conditions.failed.isNullOrBlank()) {
                            setErrorMessage(update.status.conditions.failed)
                        }
                        when (update.status.phase) {
                            "preparing" -> {
                                phaseMessage.text = "Preparing"
                                statusMessage.text = "Preparing workspace..."
                            }

                            "building" -> {
                                phaseMessage.text = "Building"
                                statusMessage.text = "Building workspace image..."
                            }

                            "pending" -> {
                                phaseMessage.text = "Preparing"
                                statusMessage.text = "Allocating resources …"
                            }

                            "creating" -> {
                                phaseMessage.text = "Creating"
                                statusMessage.text = "Pulling workspace image …"
                            }

                            "initializing" -> {
                                phaseMessage.text = "Starting"
                                statusMessage.text = "Initializing workspace content …"
                            }

                            "running" -> {
                                phaseMessage.text = "Running"
                                statusMessage.text = "Connecting..."
                            }

                            "interrupted" -> {
                                phaseMessage.text = "Starting"
                                statusMessage.text = "Checking workspace …"
                            }

                            "stopping" -> {
                                phaseMessage.text = "Stopping"
                                statusMessage.text = ""
                            }

                            "stopped" -> {
                                if (update.status.conditions.timeout.isNullOrBlank()) {
                                    phaseMessage.text = "Stopped"
                                } else {
                                    phaseMessage.text = "Timed Out"
                                }
                                statusMessage.text = ""
                            }

                            else -> {
                                phaseMessage.text = ""
                                statusMessage.text = ""
                            }
                        }
                        if (update.status.phase == "stopping" || update.status.phase == "stopped") {
                            canceledByGitpod = true
                            thinClientJob?.cancel()
                            thinClient?.close()
                        }

                        if (thinClientJob == null && update.status.phase == "running") {
                            thinClientJob = launch thinClientJob@{
                                try {
                                    val ideUrl = URL(resolvedIdeUrl)
                                    val ownerToken = client.server.getOwnerToken(update.workspaceId).await()

                                    var credentials = resolveCredentialsWithDirectSSH(
                                        ideUrl,
                                        ownerToken,
                                        connectParams,
                                    )
                                    if (credentials == null) {
                                        credentials = resolveCredentialsWithWebSocketTunnel(
                                            ideUrl,
                                            ownerToken,
                                            connectParams,
                                            connectionLifetime
                                        )
                                    }
                                    if (credentials == null) {
                                        setErrorMessage("${connectParams.gitpodHost} installation does not allow SSH access")
                                        return@thinClientJob
                                    }

                                    var joinLinkResp = resolveJoinLink(ideUrl, ownerToken, connectParams)
                                    if (joinLinkResp == null || joinLinkResp.joinLink.isNullOrEmpty()) {
                                        setErrorMessage("failed to fetch JetBrains Gateway Join Link.")
                                        return@thinClientJob
                                    }
                                    val clientHandle = connectionHandleFactory.connect(
                                        connectionLifetime,
                                        SshHostTunnelConnector(credentials),
                                        URI(joinLinkResp.joinLink)
                                    )
                                    var triggeredClientClosed = false
                                    clientHandle.clientClosed.advise(connectionLifetime) {
                                        // Been canceled by user
                                        if (!canceledByGitpod) {
                                            connectionLifetime.launch {
                                                // Delay for 5 seconds to see if thinClient could be terminated in time
                                                // Then we don't see error dialog from Gateway
                                                delay(5000)
                                                application.invokeLater {
                                                    connectionLifetime.terminate()
                                                }
                                            }
                                            return@advise
                                        }
                                        if (triggeredClientClosed) {
                                            return@advise
                                        }
                                        triggeredClientClosed = true
                                        // Wait until workspace is stopped
                                        suspend fun waitUntilStopped(): Boolean {
                                            while (lastUpdate.status.phase != "stopped") {
                                                delay(1000)
                                            }
                                            return true
                                        }
                                        // Check if it's timed out, if so, show timed out dialog
                                        connectionLifetime.launch {
                                            val isInStoppedPhase = waitUntilStopped()
                                            val isTimedOut = isInStoppedPhase && phaseMessage.text == "Timed Out"
                                            application.invokeLater {
                                                if (isTimedOut) {
                                                    showTimedOutDialogDialog(connectParams.resolvedWorkspaceId, lastUpdate.status.conditions.timeout)
                                                }
                                                connectionLifetime.terminate()
                                            }
                                        }
                                    }
                                    clientHandle.onClientPresenceChanged.advise(connectionLifetime) {
                                        application.invokeLater {
                                            if (clientHandle.clientPresent) {
                                                statusMessage.text = ""
                                            }
                                        }
                                    }
                                    var backendStatusJob: Job? = null
                                    if (joinLinkResp.appPid > 0) {
                                        backendStatusJob = launch backendStatusJob@{
                                            while (isActive) {
                                                try {
                                                    delay(5000)
                                                    val updatedJoinLinkResp = resolveJoinLink(ideUrl, ownerToken, connectParams)
                                                    if (updatedJoinLinkResp != null && joinLinkResp != null && joinLinkResp!!.appPid > 0 && updatedJoinLinkResp.appPid > 0 && updatedJoinLinkResp.appPid != joinLinkResp!!.appPid) {
                                                        clientHandle.notifyReconnect()
                                                        clientHandle.updateJoinLink(URI(updatedJoinLinkResp.joinLink), true)
                                                        joinLinkResp = updatedJoinLinkResp
                                                    }
                                                } catch (t: Throwable) {
                                                    if (t is CancellationException) {
                                                        return@backendStatusJob
                                                    }
                                                    thisLogger().error(
                                                        "${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to reconnect:",
                                                        t
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    connectionLifetime.onTerminationOrNow {
                                        backendStatusJob?.cancel()
                                    }
                                    thinClient = clientHandle
                                } catch (t: Throwable) {
                                    if (t is CancellationException) {
                                        throw t
                                    }
                                    thisLogger().error(
                                        "${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to connect:",
                                        t
                                    )
                                    setErrorMessage("" + t.message)
                                }
                            }
                        }
                    } catch (e: Throwable) {
                        thisLogger().error(
                            "${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to process workspace update:",
                            e
                        )
                    }
                }
                connectionLifetime.terminate()
            } catch (t: Throwable) {
                thisLogger().error(
                    "${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to process workspace updates:",
                    t
                )
                setErrorMessage("failed to process workspace updates ${t.message}")
            }
        }

        return connectionHandleFactory.createGitpodConnectionHandle(connectionLifetime, connectionPanel, connectParams)
    }

    private suspend fun resolveCredentialsWithWebSocketTunnel(
        ideUrl: URL,
        ownerToken: String,
        connectParams: ConnectParams,
        connectionLifetime: Lifetime,
    ): RemoteCredentialsHolder? {
        val keyPair = createSSHKeyPair(ideUrl, connectParams, ownerToken)
        if (keyPair == null || keyPair.privateKey.isNullOrEmpty()) {
            return null
        }

        try {
            val privateKeyFile = kotlin.io.path.createTempFile()
            privateKeyFile.writeText(keyPair.privateKey)
            connectionLifetime.onTerminationOrNow {
                privateKeyFile.delete()
            }

            val proxies = JdkProxyProvider.getInstance().proxySelector.select(ideUrl.toURI())
            val sslContext = CertificateManager.getInstance().sslContext
            val sshWebSocketServer = GitpodWebSocketTunnelServer(
                "wss://${ideUrl.host}/_supervisor/tunnel/ssh",
                ownerToken,
                proxies,
                sslContext
            )
            sshWebSocketServer.start(connectionLifetime)

            var hostKeys = emptyList<SSHHostKey>()
            if (keyPair.hostKey != null) {
                hostKeys = listOf(SSHHostKey(keyPair.hostKey.type, keyPair.hostKey.value))
            }
            val gatewayHostKeys = resolveHostKeys(ideUrl, connectParams)
            hostKeys = hostKeys + gatewayHostKeys.orEmpty()

            var userName = keyPair.userName
            if (userName.isNullOrBlank()) {
                userName = "gitpod"
            }

            return resolveCredentials(
                "localhost",
                sshWebSocketServer.port,
                userName,
                null,
                privateKeyFile.absolutePathString(),
                hostKeys
            )
        } catch (t: Throwable) {
            thisLogger().error(
                "${connectParams.gitpodHost}: web socket tunnel: failed to connect:",
                t
            )
            return null
        }
    }

    private suspend fun resolveCredentialsWithDirectSSH(
        ideUrl: URL,
        ownerToken: String,
        connectParams: ConnectParams
    ): RemoteCredentialsHolder? {
        if (settings.forceHttpTunnel) {
            return null
        }
        val hostKeys = resolveHostKeys(ideUrl, connectParams)
        if (hostKeys.isNullOrEmpty()) {
            thisLogger().error("${connectParams.gitpodHost}: direct SSH: failed to resolve host keys for")
            return null
        }

        try {
            val sshHostUrl =
                    URL(
                            ideUrl.toString().replace(
                                    connectParams.resolvedWorkspaceId,
                                    "${connectParams.resolvedWorkspaceId}.ssh"
                            )
                    )
            return resolveCredentials(
                sshHostUrl.host,
                22,
                connectParams.resolvedWorkspaceId,
                ownerToken,
                null,
                hostKeys
            )
        } catch (t: Throwable) {
            thisLogger().error(
                "${connectParams.gitpodHost}: direct SSH: failed to resolve credentials",
                t
            )
            return null
        }
    }

    private suspend fun resolveJoinLink(
        ideUrl: URL,
        ownerToken: String,
        connectParams: ConnectParams
    ): JoinLinkResp? {
        var resolveJoinLinkUrl = "https://24000-${ideUrl.host}/joinLink2"
        if (!connectParams.backendPort.isNullOrBlank()) {
            resolveJoinLinkUrl += "?backendPort=${connectParams.backendPort}"
        }
        var rawResp = retryFetchWS(resolveJoinLinkUrl, connectParams, ownerToken)
        if (rawResp != null) {
            return with(jacksonMapper) {
                propertyNamingStrategy = PropertyNamingStrategies.LowerCamelCaseStrategy()
                readValue(rawResp, object : TypeReference<JoinLinkResp>() {})
            }
        }

        // Fallback to old endpoint
        resolveJoinLinkUrl = "https://24000-${ideUrl.host}/joinLink"
        if (!connectParams.backendPort.isNullOrBlank()) {
            resolveJoinLinkUrl += "?backendPort=${connectParams.backendPort}"
        }
        rawResp = retryFetchWS(resolveJoinLinkUrl, connectParams, ownerToken)
        if (rawResp != null) {
            return JoinLinkResp(-1, rawResp)
        }
        return null
    }

    private var sendHeartBeatThroughSupervisorLogOnce = false
    private suspend fun sendHeartBeatThroughSupervisor(
        ideUrl: URL,
        ownerToken: String,
        connectParams: ConnectParams
    ) {
        val resp = fetchWS("https://${ideUrl.host}/_supervisor/v1/send_heartbeat", ownerToken, 2000L)
        if (resp.statusCode != 200) {
            if (!resp.body.isNullOrBlank() && resp.body.contains("not implemented")) {
                if (!sendHeartBeatThroughSupervisorLogOnce) {
                    thisLogger().warn("gitpod: sendHeartbeat ${connectParams.actualWorkspaceId} failed: method is not implemented in supervisor")
                    sendHeartBeatThroughSupervisorLogOnce = true
                }
                return
            }
            thisLogger().error("gitpod: sendHeartbeat ${connectParams.actualWorkspaceId} failed: ${resp.statusCode}, body: ${resp.body}")
            return
        }
        thisLogger().debug("gitpod: sendHeartbeat succeed for ${connectParams.actualWorkspaceId}")
    }

    private fun resolveCredentials(
        host: String,
        port: Int,
        userName: String?,
        password: String?,
        privateKeyFile: String?,
        hostKeys: List<SSHHostKey>
    ): RemoteCredentialsHolder {
        val credentials = RemoteCredentialsHolder()
        credentials.setHost(host)
        credentials.port = port
        if (userName != null) {
            credentials.userName = userName
        }
        if (password != null) {
            credentials.password = password
        } else if (privateKeyFile != null) {
            credentials.setPrivateKeyFile(privateKeyFile)
            credentials.authType = AuthType.KEY_PAIR
        }
        var builder = credentials.connectionBuilder(
            null,
            ProgressManager.getGlobalProgressIndicator(),
            false
        ).withParsingOpenSSHConfig(true)
        if (hostKeys.isNotEmpty()) {
            builder = builder.withSshConnectionConfig {
                val hostKeyVerifier = it.hostKeyVerifier
                if (hostKeyVerifier is OpenSshLikeHostKeyVerifier) {
                    val acceptHostKey = acceptHostKey(host, hostKeys)
                    it.copy(
                        hostKeyVerifier = hostKeyVerifier.copy(
                            acceptChangedHostKey = acceptHostKey,
                            acceptUnknownHostKey = acceptHostKey
                        )
                    )
                } else {
                    it
                }
            }
        }
        builder.connect()
        return credentials
    }

    private suspend fun createSSHKeyPair(
        ideUrl: URL,
        connectParams: ConnectParams,
        ownerToken: String
    ): CreateSSHKeyPairResponse? {
        val value =
            retryFetchWS("https://${ideUrl.host}/_supervisor/v1/ssh_keys/create", connectParams, ownerToken)
        if (value.isNullOrBlank()) {
            return null
        }
        return with(jacksonMapper) {
            propertyNamingStrategy = PropertyNamingStrategies.LowerCamelCaseStrategy()
            readValue(value, object : TypeReference<CreateSSHKeyPairResponse>() {})
        }
    }

    private suspend fun resolveHostKeys(
        ideUrl: URL,
        connectParams: ConnectParams
    ): List<SSHHostKey>? {
        val hostKeysValue =
            retryFetchWS("https://${ideUrl.host}/_ssh/host_keys", connectParams, null)
        if (hostKeysValue.isNullOrBlank()) {
            return null
        }
        return with(jacksonMapper) {
            propertyNamingStrategy = PropertyNamingStrategies.SnakeCaseStrategy()
            readValue(hostKeysValue, object : TypeReference<List<SSHHostKey>>() {})
        }
    }

    /**
     * Convert a byte array to the corresponding hex string.
     * Extracted from https://github.com/bcgit/bc-java/blob/bc3b92f1f0e78b82e2584c5fb4b226a13e7f8b3b/core/src/main/java/org/bouncycastle/pqc/math/linearalgebra/ByteUtils.java#L236-L258
     *
     * @param input     the byte array to be converted
     * @param prefix    the prefix to put at the beginning of the hex string
     * @param separator a separator string
     * @return the corresponding hex string
     */
    @Suppress("SameParameterValue")
    private fun toHexString(input: ByteArray, prefix: String?, separator: String?): String? {
        val hexChars = charArrayOf('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f')
        var result = prefix
        for (i in input.indices) {
            result += hexChars[input[i].toInt() ushr 4 and 0x0f]
            result += hexChars[input[i].toInt() and 0x0f]
            if (i < input.size - 1) {
                result += separator
            }
        }
        return result
    }

    private fun acceptHostKey(
        host: String,
        hostKeys: List<SSHHostKey>
    ): AskAboutHostKey {
        val hostKeysByType = hostKeys.groupBy({ it.type.lowercase() }) { it.hostKey }
        val acceptHostKey: AskAboutHostKey = { hostName, keyType, fingerprint, _ ->
            if (hostName != host) {
                false
            }
            val matchedHostKeys = hostKeysByType[keyType.lowercase()]
            if (matchedHostKeys.isNullOrEmpty()) {
                false
            }
            var matchedFingerprint = false
            for (hostKey in matchedHostKeys!!) {
                for (digest in listOf(
                    DigestUtil.md5(),
                    DigestUtil.sha256(),
                    DigestUtil.sha1()
                )) {
                    val bytes =
                        digest.digest(Base64.getDecoder().decode(hostKey))
                    val hostKeyFingerprint = toHexString(bytes, "", ":")
                    if (hostKeyFingerprint == fingerprint) {
                        matchedFingerprint = true
                        break
                    }
                }
            }
            matchedFingerprint
        }
        return acceptHostKey
    }

    data class HttpResponseData(val statusCode: Int, val body: String?) {
        fun statusCode() = statusCode
        fun body() = body
    }

    private suspend fun fetchWS(
        endpointUrl: String,
        ownerToken: String?,
        timeoutMillis: Long,
    ): HttpResponseData {
        var httpRequestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(endpointUrl))
            .GET()
            .timeout(Duration.ofMillis(timeoutMillis))
        if (!ownerToken.isNullOrBlank()) {
            httpRequestBuilder = httpRequestBuilder.header("x-gitpod-owner-token", ownerToken)
        }
        val httpRequest = httpRequestBuilder.build()
        val responseFuture =
            httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())

        try {
            val response = responseFuture.await()
            return HttpResponseData(response.statusCode(), response.body())
        } catch (e: Exception) {
            if (responseFuture.isCancelled) {
                throw CancellationException()
            }
            throw e
        }
    }

    private suspend fun retryFetchWS(
        endpointUrl: String,
        connectParams: ConnectParams,
        ownerToken: String?
    ): String? {
        val maxRequestTimeout = 30 * 1000L
        val timeoutDelayGrowFactor = 1.5
        var requestTimeout = 2 * 1000L
        while (true) {
            coroutineContext.job.ensureActive()
            try {
                val response = fetchWS(endpointUrl, ownerToken, requestTimeout)
                if (response.statusCode() == 200) {
                    return response.body()
                }
                if (response.statusCode() < 500) {
                    thisLogger().error("${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to fetch '$endpointUrl': ${response.statusCode()}")
                    return null
                }
                thisLogger().warn("${connectParams.gitpodHost}: ${connectParams.resolvedWorkspaceId}: failed to fetch '$endpointUrl', trying again...: ${response.statusCode()}")
            } catch (t: Throwable) {
                if (t is CancellationException) {
                    throw t
                }
                thisLogger().warn(
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

    override fun isApplicable(parameters: Map<String, String>): Boolean =
        parameters.containsKey("gitpodHost")

    data class ConnectParams(
        val gitpodHost: String,
        val actualWorkspaceId: String,
        val backendPort: String?,
        val debugWorkspace: Boolean,
    ) {
        val resolvedWorkspaceId = "${if (debugWorkspace) "debug-" else ""}$actualWorkspaceId"
        val title = "$resolvedWorkspaceId ($gitpodHost)"
    }

    private data class SSHHostKey(val type: String, val hostKey: String)

    private data class SSHPublicKey(val type: String, val value: String)

    private data class CreateSSHKeyPairResponse(val privateKey: String, val hostKey: SSHPublicKey?, val userName: String?)

    private data class JoinLinkResp(val appPid: Int, val joinLink: String)
}
