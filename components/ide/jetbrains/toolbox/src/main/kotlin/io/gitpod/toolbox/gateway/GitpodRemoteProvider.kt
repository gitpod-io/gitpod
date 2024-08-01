// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
import io.gitpod.toolbox.auth.GitpodOrganizationPage
import io.gitpod.toolbox.components.GitpodIcon
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.ConnectParams
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import io.gitpod.toolbox.service.getConnectParams
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.net.URI

class GitpodRemoteProvider(
    private val consumer: RemoteEnvironmentConsumer,
) : RemoteProvider {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val authManger = GitpodAuthManager()
    private val publicApi = GitpodPublicApiManager(authManger)
    private val loginPage = GitpodLoginPage(authManger)
    private val organizationPage = GitpodOrganizationPage(authManger, publicApi)

    // cache consumed environments map locally
    private val environmentMap = mutableMapOf<String, GitpodRemoteProviderEnvironment>()

    private var pendingConnectParams: Pair<String, ConnectParams>? = null
    private val openInToolboxUriHandler = GitpodOpenInToolboxUriHandler { (gitpodHost, connectParams) ->
        if (!authManger.loginWithHost(gitpodHost)) {
            pendingConnectParams = gitpodHost to connectParams
            return@GitpodOpenInToolboxUriHandler
        }
        Utils.toolboxUi.showWindow()
        Utils.toolboxUi.showPluginEnvironmentsPage()
        setEnvironmentVisibility(connectParams)
    }

    // TODO: multiple host support
    private fun setEnvironmentVisibility(connectParams: ConnectParams) {
        val workspaceId = connectParams.workspaceId
        logger.info("setEnvironmentVisibility $workspaceId")
        val env = environmentMap[connectParams.uniqueID]
        if (env != null) {
            env.markActive()
            Utils.clientHelper.setAutoConnectOnEnvironmentReady(connectParams.uniqueID, "GO-242.20224.39", "/workspace/empty")
        } else {
            GitpodRemoteProviderEnvironment(authManger, connectParams, publicApi).apply {
                environmentMap[connectParams.uniqueID] = this
                this.markActive()
                consumer.consumeEnvironments(listOf(this))
                Utils.clientHelper.setAutoConnectOnEnvironmentReady(workspaceId, "GO-242.20224.39", "/workspace/empty")
            }
        }
    }

    init {
        Utils.coroutineScope.launch {
            Utils.dataManager.sharedWorkspaceList.collect { workspaces ->
                if (workspaces.isEmpty()) {
                    return@collect
                }
                consumer.consumeEnvironments(workspaces.map {
                    val connectParams = it.getConnectParams()
                    val env = environmentMap[connectParams.uniqueID] ?: GitpodRemoteProviderEnvironment(authManger, connectParams, publicApi)
                    environmentMap[connectParams.uniqueID] = env
                    if (connectParams.uniqueID == pendingConnectParams?.second?.uniqueID) {
                        setEnvironmentVisibility(connectParams)
                        pendingConnectParams = null
                    }
                    env
                })
            }
        }
    }

    private fun startup() {
        val account = authManger.getCurrentAccount() ?: return
        publicApi.setup()
        val orgId = Utils.gitpodSettings.organizationId
        logger.info("user logged in, current selected org: $orgId")
        if (orgId != null) {
            Utils.dataManager.startWatchWorkspaces(publicApi)
        } else {
            Utils.coroutineScope.launch {
                organizationPage.loadData()
                Utils.toolboxUi.showUiPage(organizationPage)
            }
        }
        Utils.gitpodSettings.onSettingsChanged { key, _ ->
            when (key) {
                GitpodSettings.SettingKey.ORGANIZATION_ID.name -> {
                    Utils.dataManager.startWatchWorkspaces(publicApi)
                }
            }
        }
    }

    override fun getOverrideUiPage(): UiPage? {
        val account = authManger.getCurrentAccount()
        logger.info("get override ui page for ${account?.getHost()}")
        account ?: return loginPage
        startup()
        authManger.addLoginListener {
            Utils.toolboxUi.showWindow()
            Utils.toolboxUi.showPluginEnvironmentsPage()
            startup()
        }
        authManger.addLogoutListener {
            Utils.toolboxUi.showWindow()
            Utils.toolboxUi.showPluginEnvironmentsPage()
        }
        return null
    }

    override fun close() {}

    override fun getName(): String = "Gitpod"
    override fun getSvgIcon() = GitpodIcon()

    override fun getNewEnvironmentUiPage() = UiPage.empty

    override fun getAccountDropDown(): AccountDropdownField? {
        val account = authManger.getCurrentAccount() ?: return null
        return AccountDropdownField(account.fullName) {
            authManger.logout()
        }
    }

    override fun getAdditionalPluginActions(): MutableList<ActionDescription> {
        return mutableListOf(
            SimpleButton("View documents") {
                Utils.openUrl("https://gitpod.io/docs")
            },
            SimpleButton("Select organization") {
                Utils.coroutineScope.launch {
                    organizationPage.loadData()
                    Utils.toolboxUi.showUiPage(organizationPage)
                }
            }
        )
    }

    override fun canCreateNewEnvironments(): Boolean = false
    override fun isSingleEnvironment(): Boolean = false

    override fun setVisible(visibilityState: ProviderVisibilityState) {}

    override fun addEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}
    override fun removeEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}

    override fun handleUri(uri: URI) {
        if (authManger.tryHandle(uri)) {
            return
        }
        if (openInToolboxUriHandler.tryHandle(uri)) {
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
