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
import io.gitpod.toolbox.colima.ColimaTestEnvironment
import io.gitpod.toolbox.components.GitpodIcon
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.net.URI
import java.net.URLEncoder

class GitpodRemoteProvider(
    private val consumer: RemoteEnvironmentConsumer,
) : RemoteProvider {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val authManger = GitpodAuthManager()
    private val publicApi = GitpodPublicApiManager(authManger)
    private val loginPage = GitpodLoginPage(authManger)
    private val newEnvPage = GitpodNewEnvironmentPage(authManger, publicApi)
    private val organizationPage = GitpodOrganizationPage(authManger, publicApi)

    // cache consumed environments map locally
    private val environmentMap = mutableMapOf<String, GitpodRemoteProviderEnvironment>()

    private val openInToolboxUriHandler = GitpodOpenInToolboxUriHandler { connectParams ->
        Utils.toolboxUi.showPluginEnvironmentsPage()
        setEnvironmentVisibility(connectParams.workspaceId)
    }

    // TODO: multiple host support
    private fun setEnvironmentVisibility(workspaceId: String) {
        logger.info("setEnvironmentVisibility $workspaceId")
        Utils.toolboxUi.showWindow()
        val env = environmentMap[workspaceId]
        if (env != null) {
            env.markActive()
            Utils.clientHelper.setAutoConnectOnEnvironmentReady(workspaceId, "GO-233.15026.17", "/workspace/empty")
        } else {
            GitpodRemoteProviderEnvironment(authManger, workspaceId, publicApi).apply {
                environmentMap[workspaceId] = this
                this.markActive()
                consumer.consumeEnvironments(listOf(this))
                Utils.clientHelper.setAutoConnectOnEnvironmentReady(workspaceId, "GO-233.15026.17", "/workspace/empty")
            }
        }
    }

    init {
        startup()
        authManger.addLoginListener {
            logger.info("user logged in ${authManger.getCurrentAccount()?.id}")
            startup()
            // TODO: showPluginEnvironmentsPage not refresh the page
            Utils.toolboxUi.showPluginEnvironmentsPage()
        }
        authManger.addLogoutListener {
            logger.info("user logged out ${authManger.getCurrentAccount()?.id}")
            // TODO: showPluginEnvironmentsPage not refresh the page
            Utils.toolboxUi.showPluginEnvironmentsPage()
        }
        Utils.coroutineScope.launch {
            Utils.dataManager.sharedWorkspaceList.collect { workspaces ->
                if (workspaces.isEmpty()) {
                    return@collect
                }
                workspaces.forEach{
                    val host = URLEncoder.encode("https://exp-migration.preview.gitpod-dev.com", "UTF-8")
                    val workspaceId = URLEncoder.encode(it.id, "UTF-8")
                    val debugWorkspace = "false"
                    val newUri = "jetbrains://gateway/io.gitpod.toolbox.gateway/open-in-toolbox?host=${host}&workspaceId=${workspaceId}&debugWorkspace=${debugWorkspace}"
                    logger.info("workspace ${it.id} $newUri")
                }
                consumer.consumeEnvironments(workspaces.map {
                    val env = environmentMap[it.id]
                    if (env != null) {
                        env
                    } else {
                        val newEnv = GitpodRemoteProviderEnvironment(authManger, it.id, publicApi)
                        environmentMap[it.id] = newEnv
                        newEnv
                    }
                })
            }
        }
    }

    private fun startup() {
        val account = authManger.getCurrentAccount() ?: return
        publicApi.setup()
        val orgId = account.organizationId
        logger.info("user logged in, current selected org: $orgId")
        if (orgId != null) {
            Utils.dataManager.startWatchWorkspaces(publicApi)
        } else {
            Utils.coroutineScope.launch {
                organizationPage.loadData()
                Utils.toolboxUi.showUiPage(organizationPage)
            }
        }
        authManger.getCurrentAccount()?.onOrgSelected {
            Utils.dataManager.startWatchWorkspaces(publicApi)
        }
    }

    override fun getOverrideUiPage(): UiPage? {
        logger.info("getOverrideUiPage")
        authManger.getCurrentAccount() ?: return loginPage
        return null
    }

    override fun close() {}

    override fun getName(): String = "Gitpod"
    override fun getSvgIcon() = GitpodIcon()

    override fun getNewEnvironmentUiPage() = newEnvPage

    override fun getAccountDropDown(): AccountDropdownField? {
        val account = authManger.getCurrentAccount() ?: return null
        return AccountDropdownField(account.fullName) {
            authManger.logout()
        }
    }

    private fun testColima() = run {
        val env = ColimaTestEnvironment()
        consumer.consumeEnvironments(listOf(env))
        Utils.clientHelper.setAutoConnectOnEnvironmentReady("colima", "IU-241.14494.240", "/home/hwen.linux/project")
    }

    override fun getAdditionalPluginActions(): MutableList<ActionDescription> {
        return mutableListOf(
            SimpleButton("View documents") {
                Utils.openUrl("https://gitpod.io/docs")
            },
            SimpleButton("Colima") {
                testColima()
            },
            SimpleButton("Show toast") {
                logger.info("toast shown")
                val t = Utils.toolboxUi.showInfoPopup("This is header", "This is content", "okText")
                Utils.coroutineScope.launch {
                    t.get()
                    logger.info("toast closed")
                }
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
