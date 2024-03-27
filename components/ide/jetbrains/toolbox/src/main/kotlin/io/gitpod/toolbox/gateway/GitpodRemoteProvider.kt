package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.ProviderVisibilityState
import com.jetbrains.toolbox.gateway.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.gateway.RemoteProvider
import com.jetbrains.toolbox.gateway.deploy.DiagnosticInfoCollector
import io.gitpod.toolbox.data.GitpodPublicApiManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.net.URI
import okhttp3.OkHttpClient

class GitpodRemoteProvider(
        private val httpClient: OkHttpClient,
        private val consumer: RemoteEnvironmentConsumer,
        coroutineScope: CoroutineScope,
) : RemoteProvider {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val publicApi = GitpodPublicApiManager(logger)

    init {
        coroutineScope.launch {
            val resp = publicApi.listWorkspaces(publicApi.getCurrentOrganizationId())
            consumer.consumeEnvironments(resp.workspacesList.map { GitpodRemoteProviderEnvironment(it, publicApi, httpClient, coroutineScope, logger) })
        }
    }

    override fun close() {}

    override fun getName(): String = "Gitpod"
    override fun getSvgIcon(): ByteArray {
        return this::class.java.getResourceAsStream("/icon.svg")?.readAllBytes() ?: byteArrayOf()
    }

    override fun canCreateNewEnvironments(): Boolean = true
    override fun isSingleEnvironment(): Boolean = false

    override fun setVisible(visibilityState: ProviderVisibilityState) {}

    override fun addEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}
    override fun removeEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}

    override fun handleUri(uri: URI) {
        logger.debug("External request: {}", uri)
    }

    override fun getDiagnosticInfoCollector(): DiagnosticInfoCollector? {
        return GitpodLogger(logger)
    }
}
