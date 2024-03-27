package io.gitpod.toolbox.auth

import com.jetbrains.toolbox.gateway.ToolboxServiceLocator
import com.jetbrains.toolbox.gateway.auth.Account
import com.jetbrains.toolbox.gateway.auth.AuthConfiguration
import com.jetbrains.toolbox.gateway.auth.ContentType
import com.jetbrains.toolbox.gateway.auth.OAuthToken
import com.jetbrains.toolbox.gateway.auth.PluginAuthManager
import com.jetbrains.toolbox.gateway.auth.RefreshConfiguration
import okhttp3.internal.wait
import org.slf4j.LoggerFactory
import java.net.URI
import java.util.concurrent.Future
import java.util.concurrent.FutureTask

class GitpodAuthManager(serviceLocator: ToolboxServiceLocator) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val manager: PluginAuthManager<GitpodAccount, GitpodLoginConfiguration>

    init {
        manager = serviceLocator.getAuthManager(
            "gitpod",
            GitpodAccount::class.java,
            { it.toStoredData() },
            { GitpodAccount.fromStoredData(it) },
            { oauthToken, authCfg ->
                getAuthenticatedUser(authCfg.baseUrl, oauthToken)
            },
            { oauthToken, gpAccount ->
                getAuthenticatedUser(gpAccount.getHost(), oauthToken)
            },
            { gpLoginCfg ->
                val authParams = mapOf(
                    "client_id" to "toolbox-gateway-gitpod-plugin",
                    "redirect_uri" to "jetbrains://gateway/io.gitpod.toolbox.gateway/complete-oauth",
                    "scope" to "function:*",
                )
                val tokenParams =
                    mapOf("grant_type" to "authorization_code", "client_id" to "toolbox-gateway-gitpod-plugin")
                AuthConfiguration(
                    authParams,
                    tokenParams,
                    gpLoginCfg.host,
                    gpLoginCfg.host+"/api/oauth/authorize",
                    gpLoginCfg.host+"/api/oauth/token",
                    "code_challenge",
                    "S256",
                    "code_verifier",
                    "Bearer"
                )
            },
            { account ->
                RefreshConfiguration("", mapOf(), "", ContentType.JSON)
            },
        )

        manager.addEventListener {
            logger.info("============hwen.login.managerEvent${it.accountId} ${it.type.name}")
        }
    }

    fun getLoginUrl(gitpodHost: String): String {
        logger.info("get oauth url of $gitpodHost")
        return manager.initiateLogin(GitpodLoginConfiguration(gitpodHost))
    }

    fun getAuthenticatedUser(gitpodHost: String, oAuthToken: OAuthToken): Future<GitpodAccount> {
        logger.info("=================hwen.login $gitpodHost : ${oAuthToken.authorizationHeader}")
        return FutureTask {
            GitpodAccount(oAuthToken.authorizationHeader, "", "hwen-test", gitpodHost)
        }
    }

    fun tryHandle(uri: URI): Boolean {
        if (!this.manager.canHandle(uri)) {
            return false
        }
        val t = this.manager.handle(uri)
        val t2 = t.wait()
        logger.info("============hwen.login.tryHandle ${t2} ${uri.path}")
        return true
    }
}

class GitpodLoginConfiguration(public val host: String)

class GitpodAccount(private val credentials: String, private val id: String, private val name: String, private val host: String) : Account {
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