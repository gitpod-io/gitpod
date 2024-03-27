package io.gitpod.toolbox.auth

import com.jetbrains.toolbox.gateway.ToolboxServiceLocator
import com.jetbrains.toolbox.gateway.auth.*
import io.gitpod.toolbox.data.GitpodPublicApiManager
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.future
import okhttp3.EventListener
import org.slf4j.LoggerFactory
import java.net.URI
import java.util.concurrent.Future

class GitpodAuthManager(serviceLocator: ToolboxServiceLocator, val publicApi: GitpodPublicApiManager) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val manager: PluginAuthManager<GitpodAccount, GitpodLoginConfiguration>
    private var loginListeners: MutableList<() -> Unit> = mutableListOf()

    init {
        manager = serviceLocator.getAuthManager(
            "gitpod",
            GitpodAccount::class.java,
            { it.toStoredData() },
            { GitpodAccount.fromStoredData(it) },
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
                    loginListeners.forEach { it() }
                    logger.info("============hwen.login ${it.accountId}")
                }

                AuthEvent.Type.LOGOUT -> {
                    logger.info("============hwen.logout ${it.accountId}")
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

    fun getLoginUrl(gitpodHost: String): String {
        logger.info("get oauth url of $gitpodHost")
        return manager.initiateLogin(GitpodLoginConfiguration(gitpodHost))
    }

    fun tryHandle(uri: URI): Boolean {
        if (!this.manager.canHandle(uri)) {
            return false
        }
        this.manager.handle(uri)
        return true
    }

    fun addLoginListener(listener: () -> Unit) {
        loginListeners.add(listener)
    }

    private fun getAuthenticatedUser(gitpodHost: String, oAuthToken: OAuthToken): Future<GitpodAccount> {
        // TODO: how to remove GlobalScope?
        return GlobalScope.future {

            publicApi.setAccount(gitpodHost, oAuthToken.authorizationHeader)
            try {
                val user = publicApi.getAuthenticatedUser()
                GitpodAccount(oAuthToken.authorizationHeader, user.id, user.name, gitpodHost)
            } catch (e: Exception) {
                throw IllegalStateException("Failed to get authenticated user", e)
            }
        }
    }
}

class GitpodLoginConfiguration(val host: String)

// TODO: improve
class GitpodAccount(
    private val credentials: String,
    private val id: String,
    private val name: String,
    private val host: String
) : Account {
    override fun getId(): String {
        return id
    }

    override fun getFullName(): String {
        return name
    }

    fun getHost(): String {
        return host
    }

    fun toStoredData(): String {
        return "${credentials}:${host}:${id}:${name}"
    }

    companion object {
        fun fromStoredData(str: String): GitpodAccount {
            val arr = str.split(":")
            if (arr.size != 4) throw IllegalArgumentException("Invalid stored data")
            return GitpodAccount(arr[0], arr[1], arr[2], arr[3])
        }
    }
}