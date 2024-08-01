// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.auth

import com.jetbrains.toolbox.gateway.auth.*
import io.gitpod.publicapi.v1.UserServiceClient
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.future.future
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import java.net.URI
import java.util.*
import java.util.concurrent.Future

class GitpodAuthManager {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val manager: PluginAuthManager<GitpodAccount, GitpodLoginConfiguration>
    private var loginListeners: MutableList<() -> Unit> = mutableListOf()
    private var logoutListeners: MutableList<() -> Unit> = mutableListOf()

    init {
        manager = Utils.sharedServiceLocator.getAuthManager(
            "gitpod",
            GitpodAccount::class.java,
            { it.encode() },
            { GitpodAccount.decode(it) },
            { oauthToken, authCfg -> getAuthenticatedUser(authCfg.baseUrl, oauthToken) },
            { oauthToken, gpAccount -> getAuthenticatedUser(gpAccount.getHost(), oauthToken) },
            { gpLoginCfg ->
                val authParams = mapOf(
                    "response_type" to "code",
                    "client_id" to "toolbox-gateway-gitpod-plugin",
                    "scope" to "function:*",
                )
                val tokenParams =
                    mapOf("grant_type" to "authorization_code", "client_id" to "toolbox-gateway-gitpod-plugin")
                AuthConfiguration(
                    authParams,
                    tokenParams,
                    gpLoginCfg.host,
                    gpLoginCfg.host + "/api/oauth/authorize",
                    gpLoginCfg.host + "/api/oauth/token",
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
                    logger.debug("gitpod: user logged in ${it.accountId}")
                    resetCurrentAccount(it.accountId)
                    loginListeners.forEach { it() }
                }

                AuthEvent.Type.LOGOUT -> {
                    logger.debug("gitpod: user logged out ${it.accountId}")
                    resetCurrentAccount(it.accountId)
                    logoutListeners.forEach { it() }
                }
            }
        }
    }

    private fun resetCurrentAccount(accountId: String) {
        val account = manager.accountsWithStatus.find { it.account.id == accountId }?.account ?: return
        logger.debug("reset settings for ${account.getHost()}")
        Utils.gitpodSettings.resetSettings(account.getHost())
    }

    fun getCurrentAccount(): GitpodAccount? {
        return manager.accountsWithStatus.find { it.account.getHost() == Utils.gitpodSettings.gitpodHost }?.account
    }

    fun loginWithHost(host: String): Boolean {
        if (getCurrentAccount()?.getHost() == host) {
            // TODO: validate token is still available
            return true
        }
        val account = manager.accountsWithStatus.find { it.account.getHost() == host }?.account
        if (account != null) {
            Utils.gitpodSettings.gitpodHost = host
            loginListeners.forEach { it() }
            // TODO: validate token is still available
            return true
        }
        Utils.openUrl(this.getOAuthLoginUrl(host))
        return false
    }

    fun logout() {
        getCurrentAccount()?.let { manager.logout(it.id) }
    }

    fun getOAuthLoginUrl(gitpodHost: String): String {
        logger.info("get oauth url of $gitpodHost")
        return manager.initiateLogin(GitpodLoginConfiguration(gitpodHost))
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
            val user = GitpodPublicApiManager.tryGetAuthenticatedUser(UserServiceClient(client), logger)
            GitpodAccount(bearerToken, user.id, user.name, gitpodHost)
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

class GitpodLoginConfiguration(val host: String)

@Serializable
class GitpodAccount(
    private val credentials: String,
    private val id: String,
    private val name: String,
    private val host: String
) : Account {

    override fun getId() = id
    override fun getFullName() = name
    fun getCredentials() = credentials
    fun getHost() = host

    fun encode(): String {
        return Json.encodeToString(this)
    }

    companion object {
        fun decode(str: String): GitpodAccount {
            return Json.decodeFromString<GitpodAccount>(str)
        }
    }
}
