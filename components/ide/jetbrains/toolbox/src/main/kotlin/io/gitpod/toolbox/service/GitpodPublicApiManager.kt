// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import com.connectrpc.*
import com.connectrpc.extensions.GoogleJavaProtobufStrategy
import com.connectrpc.http.clone
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import com.connectrpc.protocols.NetworkProtocol
import io.gitpod.publicapi.experimental.v1.*
import io.gitpod.toolbox.auth.GitpodAccount
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.utils.GitpodLogger
import io.gitpod.toolbox.utils.await
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.Request
import java.net.URL
import java.time.Duration

class GitpodPublicApiManager(private val authManger: GitpodAuthManager) {
    private var workspaceApi: WorkspacesServiceClientInterface? = null
    private var organizationApi: TeamsServiceClientInterface? = null
    private var userApi: UserServiceClientInterface? = null
    private var account: GitpodAccount? = null

    init {
        authManger.addLogoutListener {
            workspaceApi = null
            organizationApi = null
            userApi = null
            account = null
        }
    }

    fun setup() {
        val account = authManger.getCurrentAccount() ?: return
        this.account = account
        GitpodLogger.info("setup papi client for ${account.getHost()}")
        val client = createClient(account.getHost(), account.getCredentials())
        workspaceApi = WorkspacesServiceClient(client)
        organizationApi = TeamsServiceClient(client)
        userApi = UserServiceClient(client)
    }

    fun watchWorkspaceStatus(workspaceId: String, consumer: (String, Workspaces.WorkspaceInstanceStatus) -> Unit): Job {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")

        return Utils.coroutineScope.launch {
            val workspace = getWorkspace(workspaceId)
            consumer(workspace.workspaceId, workspace.status.instance.status)
            val stream = workspaceApi.streamWorkspaceStatus()
            stream.sendAndClose(Workspaces.StreamWorkspaceStatusRequest.newBuilder().setWorkspaceId(workspaceId).build())
            val chan = stream.responseChannel()
            try {
                for (response in chan) {
                    consumer(response.result.instance.workspaceId, response.result.instance.status)
                }
            }
            finally {
                chan.cancel()
            }
        }
    }

    suspend fun listWorkspaces(): List<Workspaces.Workspace> {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val resp = workspaceApi.listWorkspaces(Workspaces.ListWorkspacesRequest.newBuilder().build())
        return this.handleResp("listWorkspaces", resp).resultList.filter { it.status.instance.status.usingToolbox() }
    }

    suspend fun getWorkspace(workspaceId: String): Workspaces.Workspace {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val resp = workspaceApi.getWorkspace(Workspaces.GetWorkspaceRequest.newBuilder().setWorkspaceId(workspaceId).build())
        return this.handleResp("getWorkspace", resp).result
    }

    suspend fun getWorkspaceOwnerToken(workspaceId: String): String {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val resp = workspaceApi.getOwnerToken(Workspaces.GetOwnerTokenRequest.newBuilder().setWorkspaceId(workspaceId).build())
        return this.handleResp("getOwnerToken", resp).token
    }

    @Serializable
    class JoinLink2Response(val appPid: Int, val joinLink: String, val ideVersion: String, val projectPath: String)

    suspend fun fetchJoinLink2Info(workspaceId: String, ideURL: String): JoinLink2Response {
        val token = getWorkspaceOwnerToken(workspaceId)
        val backendUrl = "https://24000-${URL(ideURL).host}/joinLink2"
        val client = Utils.httpClient
        val req = Request.Builder().url(backendUrl).header("x-gitpod-owner-token", token)
        val response = client.newCall(req.build()).await()
        if (!response.isSuccessful) {
            throw IllegalStateException("Failed to get join link $backendUrl info: ${response.code} ${response.message}")
        }
        if (response.body == null) {
            throw IllegalStateException("Failed to get join link $backendUrl info: no body")
        }
        return Json.decodeFromString<JoinLink2Response>(response.body!!.string())
    }

    suspend fun getAuthenticatedUser(): UserOuterClass.User {
        return tryGetAuthenticatedUser(userApi)
    }

    private fun <T> handleResp(method: String, resp: ResponseMessage<T>): T {
        val data = resp.success { it.message }
        val error = resp.failure {
            GitpodLogger.error("failed to call papi.${method} $it")
            it.cause
        }
        return data ?: throw error!!
    }

    companion object {
        fun createClient(gitpodHost: String, token: String): ProtocolClient {
            // TODO: 6m?
            val client = Utils.httpClient.newBuilder().readTimeout(Duration.ofMinutes(6)).build()
            val authInterceptor = AuthorizationInterceptor(token)
            return ProtocolClient(
                httpClient = ConnectOkHttpClient(client),
                ProtocolClientConfig(
                    host = "https://api.$gitpodHost",
                    serializationStrategy = GoogleJavaProtobufStrategy(), // Or GoogleJavaJSONStrategy for JSON.
                    networkProtocol = NetworkProtocol.CONNECT,
                    interceptors = listOf { authInterceptor }
                ),
            )
        }

        /**
         * Tries to get the authenticated user from the given API client.
         * Used in GitpodAuthManager
         */
        suspend fun tryGetAuthenticatedUser(api: UserServiceClientInterface?): UserOuterClass.User {
            val userApi = api ?: throw IllegalStateException("No client")
            val resp = userApi.getAuthenticatedUser(UserOuterClass.GetAuthenticatedUserRequest.newBuilder().build())
            val user = resp.success { it.message.user }
            val err = resp.failure {
                GitpodLogger.error("failed to call papi.getAuthenticatedUser $it")
                it.cause
            }
            return user ?: throw err!!
        }
    }
}

class AuthorizationInterceptor(private val token: String) : Interceptor {
    override fun streamFunction() = StreamFunction({
        val headers = mutableMapOf<String, List<String>>()
        headers.putAll(it.headers)
        headers["Authorization"] = listOf("Bearer $token")
        return@StreamFunction it.clone(headers = headers)
    })

    override fun unaryFunction() = UnaryFunction(
        {
            val headers = mutableMapOf<String, List<String>>()
            headers.putAll(it.headers)
            headers["Authorization"] = listOf("Bearer $token")
            return@UnaryFunction it.clone(headers = headers)
        },
    )
}

// TODO: logger interceptor
