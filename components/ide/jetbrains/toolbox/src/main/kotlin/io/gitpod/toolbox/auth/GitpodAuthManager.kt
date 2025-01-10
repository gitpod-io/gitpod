// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.auth

import com.connectrpc.Code
import com.connectrpc.ConnectException
import com.jetbrains.toolbox.api.core.auth.*
import io.gitpod.publicapi.experimental.v1.UserServiceClient
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.future.future
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URI
import java.util.*
import java.util.concurrent.Future

// TODO(hw): Validate Scopes
val authScopesJetBrainsToolbox = listOf(
    "function:getGitpodTokenScopes",
    "function:getLoggedInUser",
    "function:getOwnerToken",
    "function:getWorkspace",
    "function:getWorkspaces",
    "function:listenForWorkspaceInstanceUpdates",
    "function:startWorkspace",
    "function:stopWorkspace",
    "function:deleteWorkspace",
    "function:getToken",
    "resource:default",
)

class GitpodAuthManager {
    private val manager: PluginAuthManager<GitpodAccount, GitpodLoginConfiguration>
    private var loginListeners: MutableList<() -> Unit> = mutableListOf()
    private var logoutListeners: MutableList<() -> Unit> = mutableListOf()

    init {
        manager = Utils.sharedServiceLocator.getAuthManager(
            "gitpod",
            GitpodAccount::class.java,
            { it.encode() },
            { GitpodAccount.decode(it) },
            { oauthToken, authCfg -> getAuthenticatedUser(URI.create(authCfg.baseUrl).host, oauthToken) },
            { oauthToken, gpAccount -> getAuthenticatedUser(gpAccount.getHost(), oauthToken) },
            { gpLoginCfg ->
                val authParams = mapOf(
                    "response_type" to "code",
                    "client_id" to "toolbox-gateway-gitpod-plugin",
                    "scope" to authScopesJetBrainsToolbox.joinToString("%20"),
                )
                val tokenParams =
                    mapOf("grant_type" to "authorization_code", "client_id" to "toolbox-gateway-gitpod-plugin")
                AuthConfiguration(
                    authParams,
                    tokenParams,
                    gpLoginCfg.hostUrl,
                    gpLoginCfg.hostUrl + "/api/oauth/authorize",
                    gpLoginCfg.hostUrl + "/api/oauth/token",
                    "code_challenge",
                    "S256",
                    "code_verifier",
                    "Bearer"
                )
            },
            { RefreshConfiguration("", mapOf(), "", ContentType.JSON) },
        )

        manager.addEventListener {
            when (it.type) {
                AuthEvent.Type.LOGIN -> {
                    Utils.logger.info(" user logged in ${it.accountId}")
                    resetCurrentAccount(it.accountId)
                    loginListeners.forEach { it() }
                }

                AuthEvent.Type.LOGOUT -> {
                    Utils.logger.info("user logged out ${it.accountId}")
                    resetCurrentAccount(it.accountId)
                    logoutListeners.forEach { it() }
                }
            }
        }
    }

    private fun resetCurrentAccount(accountId: String) {
        val account = manager.accountsWithStatus.find { it.account.id == accountId }?.account ?: return
        Utils.logger.debug("reset settings for ${account.getHost()}")
        Utils.gitpodSettings.resetSettings(account.getHost())
    }

    fun getCurrentAccount(): GitpodAccount? {
        return manager.accountsWithStatus.find { it.account.getHost() == Utils.gitpodSettings.gitpodHost }?.account
    }

    suspend fun loginWithHost(host: String): Boolean {
        val currentAccount = getCurrentAccount()
        if (currentAccount?.getHost() == host) {
            if (currentAccount.isValidate()) {
                return true
            } else {
                manager.logout(currentAccount.id)
                Utils.openUrl(this.getOAuthLoginUrl(host))
                return false
            }
        }
        val account = manager.accountsWithStatus.find { it.account.getHost() == host }?.account
        if (account != null) {
            if (account.isValidate()) {
                Utils.gitpodSettings.gitpodHost = host
                loginListeners.forEach { it() }
                return true
            } else {
                manager.logout(account.id)
                Utils.openUrl(this.getOAuthLoginUrl(host))
                return false
            }
        }
        Utils.openUrl(this.getOAuthLoginUrl(host))
        return false
    }

    fun logout() {
        getCurrentAccount()?.let { manager.logout(it.id) }
    }

    fun getOAuthLoginUrl(gitpodHost: String): String {
        Utils.logger.info("get oauth url of https://$gitpodHost")
        return manager.initiateLogin(GitpodLoginConfiguration("https://$gitpodHost"))
    }

    fun tryHandle(uri: URI): Boolean {
        if (!this.manager.canHandle(uri)) {
            return false
        }
        Utils.toolboxUi.showWindow()
        this.manager.handle(uri)
        return true
    }

    fun addLoginListener(listener: () -> Unit) {
        loginListeners.add(listener)
    }

    fun addLogoutListener(listener: () -> Unit) {
        logoutListeners.add(listener)
    }

    private fun getAuthenticatedUser(gitpodHost: String, oAuthToken: OAuthToken): Future<GitpodAccount> {
        return Utils.coroutineScope.future {
            val bearerToken = getBearerToken(oAuthToken)
            val client = GitpodPublicApiManager.createClient(gitpodHost, bearerToken)
            val user = GitpodPublicApiManager.tryGetAuthenticatedUser(UserServiceClient(client))
            GitpodAccount(bearerToken, user.id, user.name, gitpodHost, authScopesJetBrainsToolbox)
        }
    }

    private fun getBearerToken(oAuthToken: OAuthToken): String {
        val parts = oAuthToken.authorizationHeader.replace("Bearer ", "").split(".")
        // We don't validate jwt token
        if (parts.size != 3) {
            throw IllegalArgumentException("Invalid JWT")
        }
        val decoded = String(Base64.getUrlDecoder().decode(parts[1].toByteArray()))
        val jsonElement = Json.parseToJsonElement(decoded)
        val payloadMap = jsonElement.jsonObject.mapValues {
            it.value.jsonPrimitive.content
        }
        return payloadMap["jti"] ?: throw IllegalArgumentException("Failed to parse JWT token")
    }

}

class GitpodLoginConfiguration(val hostUrl: String)

@Serializable
class GitpodAccount : Account {
    private val credentials: String
    private val id: String
    private val name: String
    private val host: String
    private val scopes: List<String>

    constructor(credentials: String, id: String, name: String, host: String, scopes: List<String>) {
        this.credentials = credentials
        this.id = id
        this.name = name
        this.host = host
        this.scopes = scopes
    }

    override fun getId() = id
    override fun getFullName() = name
    fun getCredentials() = credentials
    fun getHost() = host
    fun getScopes() = scopes

    fun encode(): String {
        return Json.encodeToString(this)
    }

    suspend fun isValidate(): Boolean {
        val hostUrl = "https://$host"
        val client = GitpodPublicApiManager.createClient(URI(hostUrl).host, credentials)
        Utils.logger.debug("validating account $hostUrl")
        try {
            GitpodPublicApiManager.tryGetAuthenticatedUser(UserServiceClient(client))
            // TODO: Verify scopes
            return true
        } catch (e: ConnectException) {
            // TODO(hw): Server close jsonrpc so papi server respond internal error
            if (e.code == Code.UNAUTHENTICATED || (e.code == Code.INTERNAL_ERROR && e.message != null && e.message!!.contains(
                    "jsonrpc2: connection is closed"
                ))
            ) {
                Utils.logger.error("account $hostUrl is not valid")
                return false
            }
            return true
        }
    }

    companion object {
        fun decode(str: String): GitpodAccount {
            return Json.decodeFromString<GitpodAccount>(str)
        }
    }
}
