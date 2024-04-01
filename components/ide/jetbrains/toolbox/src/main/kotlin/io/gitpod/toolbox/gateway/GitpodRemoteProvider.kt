package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.ProviderVisibilityState
import com.jetbrains.toolbox.gateway.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.gateway.RemoteProvider
import com.jetbrains.toolbox.gateway.deploy.DiagnosticInfoCollector
import com.jetbrains.toolbox.gateway.ui.AccountDropdownField
import com.jetbrains.toolbox.gateway.ui.ActionDescription
import com.jetbrains.toolbox.gateway.ui.UiPage
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.auth.GitpodLoginPage
import io.gitpod.toolbox.components.GitpodIcon
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.*
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
    private val router = PageRouter()

    init {
        router.addRoutes(object : Route {
            override val page = loginPage
            override val path = ROUTE_LOGIN
        })

        startup()
        authManger.addLoginListener {
            startup()
        }
    }

    private fun startup() {
        val account = authManger.getCurrentAccount()
        if (account == null) {
            router.goTo(ROUTE_LOGIN)
            return
        }
        publicApi.setup()
        val orgId = account.organizationId
        logger.info("user logged in, selected org: $orgId")
        if (orgId != null) {
            watchWorkspaceList()
        }
        authManger.getCurrentAccount()?.onOrgSelected {
            watchWorkspaceList()
        }
    }

    override fun getOverrideUiPage(): UiPage? {
        // TODO: How to let it knows the page needs to be updated?
//        return router.getCurrentPage().let { (page, isNotFound) ->
//            if (isNotFound) null else page
//        }
        authManger.getCurrentAccount() ?: return loginPage
        return null
    }

    private fun watchWorkspaceList() {
        logger.info("start watch workspace list")
        Utils.coroutineScope.launch {
            val resp = publicApi.listWorkspaces()
            consumer.consumeEnvironments(resp.workspacesList.map {
                GitpodRemoteProviderEnvironment(
                    it,
                    publicApi,
                    httpClient
                )
            })
        }
    }

    override fun close() {}

    override fun getName(): String = "Gitpod"
    override fun getSvgIcon() = GitpodIcon()

    override fun getNewEnvironmentUiPage() = GitpodNewEnvironmentPage(publicApi)

    override fun getAccountDropDown(): AccountDropdownField? {
        val account = authManger.getCurrentAccount() ?: return null
        return AccountDropdownField(account.fullName) {
            authManger.logout()
        }
    }

    override fun getAdditionalPluginActions(): MutableList<ActionDescription> {
        return mutableListOf(SimpleButton("View documents") {
            Utils.openUrl("https://gitpod.io/docs")
        })
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

    companion object {
        const val ROUTE_LOGIN = "/login"
    }
}
