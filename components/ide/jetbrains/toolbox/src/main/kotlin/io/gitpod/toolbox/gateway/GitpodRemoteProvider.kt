package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.ProviderVisibilityState
import com.jetbrains.toolbox.gateway.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.gateway.RemoteProvider
import com.jetbrains.toolbox.gateway.deploy.DiagnosticInfoCollector
import com.jetbrains.toolbox.gateway.ui.UiPage
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.auth.GitpodLoginPage
import io.gitpod.toolbox.components.GitpodIcon
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import org.slf4j.LoggerFactory
import java.net.URI

class GitpodRemoteProvider(
        private val httpClient: OkHttpClient,
        private val consumer: RemoteEnvironmentConsumer,
) : RemoteProvider {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val authManger = GitpodAuthManager()
    private val publicApi = GitpodPublicApiManager(authManger)
    private val loginPage = GitpodLoginPage(authManger)

    init {
        authManger.addLoginListener {
            watchWorkspaceList()
        }
    }

    override fun getOverrideUiPage(): UiPage? {
        authManger.getCurrentAccount() ?: return loginPage
        return null
    }

    private fun watchWorkspaceList() {
        logger.info("start watch workspace list")
        Utils.coroutineScope.launch {
            val resp = publicApi.listWorkspaces(publicApi.getCurrentOrganizationId())
            consumer.consumeEnvironments(resp.workspacesList.map { GitpodRemoteProviderEnvironment(it, publicApi, httpClient) })
        }
    }

    override fun close() {}

    override fun getName(): String = "Gitpod"
    override fun getSvgIcon(): ByteArray {
        return GitpodIcon()
    }

    override fun getNewEnvironmentUiPage(): UiPage {
        return GitpodNewEnvironmentPage()
    }

    override fun canCreateNewEnvironments(): Boolean = true
    override fun isSingleEnvironment(): Boolean = false

    override fun setVisible(visibilityState: ProviderVisibilityState) {}

    override fun addEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}
    override fun removeEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}

    override fun handleUri(uri: URI) {
        if (authManger.tryHandle(uri)) {
            return
        }
        when (uri.path) {
            // TODO:
            else -> {
                logger.warn("Unknown request: {}", uri)
            }
        }
    }

    override fun getDiagnosticInfoCollector(): DiagnosticInfoCollector? {
        return GitpodLogger(logger)
    }
}
