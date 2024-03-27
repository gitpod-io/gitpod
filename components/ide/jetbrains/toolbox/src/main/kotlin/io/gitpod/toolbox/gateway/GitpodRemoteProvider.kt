package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.ProviderVisibilityState
import com.jetbrains.toolbox.gateway.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.gateway.RemoteProvider
import com.jetbrains.toolbox.gateway.ToolboxServiceLocator
import com.jetbrains.toolbox.gateway.deploy.DiagnosticInfoCollector
import com.jetbrains.toolbox.gateway.ui.LabelField
import com.jetbrains.toolbox.gateway.ui.ToolboxUi
import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.UiPage
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.auth.GitpodLoginPage
import io.gitpod.toolbox.data.GitpodPublicApiManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.net.URI
import okhttp3.OkHttpClient

class GitpodRemoteProvider(
        private val serviceLocator: ToolboxServiceLocator,
        private val httpClient: OkHttpClient,
        private val consumer: RemoteEnvironmentConsumer,
        private val coroutineScope: CoroutineScope,
) : RemoteProvider {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val publicApi = GitpodPublicApiManager()
    private val authManger = GitpodAuthManager(serviceLocator, publicApi)
    private val loginPage = GitpodLoginPage(serviceLocator, authManger)

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

    override fun getNewEnvironmentUiPage(): UiPage {
        return object: UiPage {
            override fun getFields(): MutableList<UiField> {
                return mutableListOf(LabelField("Welcome to Gitpod! ${authManger.getCurrentAccount()?.fullName}"))
            }

            override fun getTitle(): String {
                return "Gitpod New Env"
            }

        }
    }

    override fun canCreateNewEnvironments(): Boolean = true
    override fun isSingleEnvironment(): Boolean = false

    override fun setVisible(visibilityState: ProviderVisibilityState) {}

    override fun addEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}
    override fun removeEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}

    override fun handleUri(uri: URI) {
        when (uri.path) {
            "/io.gitpod.toolbox.gateway/auth" -> {
                authManger.tryHandle(uri)
            }
            else -> {
                logger.warn("Unknown request: {}", uri)
            }
        }
    }

    override fun getDiagnosticInfoCollector(): DiagnosticInfoCollector? {
        return GitpodLogger(logger)
    }
}
