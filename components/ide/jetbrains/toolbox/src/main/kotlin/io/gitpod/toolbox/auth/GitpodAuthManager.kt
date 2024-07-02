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
                    logger.info("account ${it.accountId} logged in")
                    loginListeners.forEach { it() }
                }
                AuthEvent.Type.LOGOUT -> {
                    logger.info("account ${it.accountId} logged out")
                    logoutListeners.forEach { it() }
                }
            }
        }
    }

    fun getCurrentAccount(): GitpodAccount? {
        return manager.accountsWithStatus.firstOrNull()?.account
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
    private val orgSelectedListeners: MutableList<(String) -> Unit> = mutableListOf()
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun getId() = id
    override fun getFullName() = name
    fun getCredentials() = credentials
    fun getHost() = host

    private fun getStoreKey(key: String) = "USER:${id}:${key}"

    var organizationId: String?
        get() = Utils.settingStore[getStoreKey("ORG")]
        set(value){
            if (value == null) {
                return
            }
            Utils.settingStore[getStoreKey("ORG")] = value
            orgSelectedListeners.forEach { it(value) }
        }

    var preferEditor: String?
        get() = Utils.settingStore[getStoreKey("EDITOR")]
        set(value){
            if (value == null) {
                return
            }
            Utils.settingStore[getStoreKey("EDITOR")] = value
        }

    var preferWorkspaceClass: String?
        get() = Utils.settingStore[getStoreKey("WS_CLS")]
        set(value){
            if (value == null) {
                return
            }
            Utils.settingStore[getStoreKey("WS_CLS")] = value
        }

    fun onOrgSelected(listener: (String) -> Unit) {
        orgSelectedListeners.add(listener)
    }

    fun encode(): String {
        return Json.encodeToString(this)
    }

    companion object {
        fun decode(str: String): GitpodAccount {
            return Json.decodeFromString<GitpodAccount>(str)
        }
    }
}
