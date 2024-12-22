// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.api.remoteDev.ProviderVisibilityState
import com.jetbrains.toolbox.api.remoteDev.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.api.remoteDev.RemoteProvider
import com.jetbrains.toolbox.api.ui.actions.ActionDescription
import com.jetbrains.toolbox.api.ui.components.AccountDropdownField
import com.jetbrains.toolbox.api.ui.components.UiPage
import io.gitpod.publicapi.experimental.v1.Workspaces
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.auth.GitpodLoginPage
import io.gitpod.toolbox.components.EmptyUiPageWithTitle
import io.gitpod.toolbox.components.GitpodIcon
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.*
import io.gitpod.toolbox.utils.GitpodLogger
import kotlinx.coroutines.launch
import java.net.URI
import java.util.concurrent.CompletableFuture

class GitpodRemoteProvider(
    private val consumer: RemoteEnvironmentConsumer,
) : RemoteProvider {
    private val authManger = GitpodAuthManager()
    private val publicApi = GitpodPublicApiManager(authManger)
    private val loginPage = GitpodLoginPage(authManger)

    // cache consumed environments map locally
    private val environmentMap = mutableMapOf<String, Pair<Workspaces.Workspace, GitpodRemoteEnvironment>>()

    private var pendingConnectParams: Pair<String, ConnectParams>? = null
    private val openInToolboxUriHandler = GitpodOpenInToolboxUriHandler { (gitpodHost, connectParams) ->
        val future = CompletableFuture<Void?>()
        Utils.coroutineScope.launch {
            if (!authManger.loginWithHost(gitpodHost)) {
                pendingConnectParams = gitpodHost to connectParams
                future.complete(null)
                return@launch
            }
            setEnvironmentVisibility(connectParams)
            future.complete(null)
        }
        return@GitpodOpenInToolboxUriHandler future
    }

    private suspend fun setEnvironmentVisibility(connectParams: ConnectParams) {
        val workspaceId = connectParams.workspaceId
        GitpodLogger.debug("setEnvironmentVisibility $workspaceId, $connectParams")
        val obj = environmentMap[connectParams.uniqueID]
        var (workspace) = obj ?: Pair(null, null)
        if (obj == null) {
            workspace = publicApi.getWorkspace(workspaceId)
            val env = GitpodRemoteEnvironment(
                authManger,
                connectParams,
                publicApi,
                Utils.observablePropertiesFactory
            )
            environmentMap[connectParams.uniqueID] = Pair(workspace, env)
            consumer.consumeEnvironments(environmentMap.values.map { it.second })
        }
        val joinLinkInfo = publicApi.fetchJoinLink2Info(workspaceId, workspace!!.getIDEUrl())
        // TODO(hw): verify if it's working
        Utils.clientHelper.prepareClient(joinLinkInfo.ideVersion)
        Utils.clientHelper.setAutoConnectOnEnvironmentReady(
            connectParams.uniqueID,
            joinLinkInfo.ideVersion,
            joinLinkInfo.projectPath
        )
    }

    private fun showWorkspacesList() {
        Utils.coroutineScope.launch {
            val workspaces = publicApi.listWorkspaces()
            if (workspaces.isEmpty()) {
                consumer.consumeEnvironments(emptyList())
                return@launch
            }
            consumer.consumeEnvironments(workspaces.map {
                val connectParams = it.getConnectParams()
                val env = environmentMap[connectParams.uniqueID]?.second ?: GitpodRemoteEnvironment(
                    authManger,
                    connectParams,
                    publicApi,
                    Utils.observablePropertiesFactory
                )
                environmentMap[connectParams.uniqueID] = Pair(it, env)
                if (connectParams.uniqueID == pendingConnectParams?.second?.uniqueID) {
                    setEnvironmentVisibility(connectParams)
                    pendingConnectParams = null
                }
                env
            })
        }
    }

    private fun startup() {
        val account = authManger.getCurrentAccount() ?: return
        publicApi.setup()
        GitpodLogger.info("startup with ${account.getHost()} ${account.id}")
        showWorkspacesList()
    }

    override fun getOverrideUiPage(): UiPage? {
        authManger.addLoginListener {
            startup()
            Utils.environmentUiPageManager.showPluginEnvironmentsPage(false)
        }
        authManger.addLogoutListener {
            Utils.environmentUiPageManager.showPluginEnvironmentsPage(false)
        }
        val account = authManger.getCurrentAccount()
        account ?: return loginPage
        startup()
        Utils.coroutineScope.launch {
            if (account.isValidate()) {
                return@launch
            }
            authManger.logout()
            Utils.environmentUiPageManager.showPluginEnvironmentsPage(false)
        }
        return null
    }

    override fun close() {}

    override fun getName(): String = "Gitpod Classic"
    override fun getSvgIcon() = GitpodIcon()

    override fun getNewEnvironmentUiPage() = EmptyUiPageWithTitle("")

    override fun getAccountDropDown(): AccountDropdownField? {
        val account = authManger.getCurrentAccount() ?: return null
        return AccountDropdownField(account.fullName) {
            authManger.logout()
        }
    }

    override fun getAdditionalPluginActions(): MutableList<ActionDescription> {
        val list = mutableListOf<ActionDescription>()
        val account = authManger.getCurrentAccount()
        if (account != null) {
            list.add(SimpleButton("Open Dashboard") { Utils.openUrl("https://${account.getHost()}/workspaces") })
        }
        list.add(SimpleButton("View Documents") { Utils.openUrl("https://www.gitpod.io/docs/introduction/getting-started") })
        list.add(SimpleButton("About Gitpod Flex") { Utils.openUrl("https://www.gitpod.io/docs/flex/getting-started") })
        return list
    }

    override fun canCreateNewEnvironments(): Boolean = false
    override fun isSingleEnvironment(): Boolean = false
    override fun getNoEnvironmentsDescription() = "No workspaces"

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
            else -> {
                GitpodLogger.warn("Unknown request: $uri")
            }
        }
    }
}
