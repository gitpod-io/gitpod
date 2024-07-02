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
import io.gitpod.publicapi.v1.*
import io.gitpod.toolbox.auth.GitpodAccount
import io.gitpod.toolbox.auth.GitpodAuthManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.time.Duration

class GitpodPublicApiManager(private val authManger: GitpodAuthManager) {
    private var workspaceApi: WorkspaceServiceClientInterface? = null
    private var organizationApi: OrganizationServiceClientInterface? = null
    private var userApi: UserServiceClientInterface? = null
    private var account: GitpodAccount? = null
    private val logger = LoggerFactory.getLogger(javaClass)

    init {
        setup()
        authManger.addLoginListener {
            setup()
        }
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
        logger.debug("setup papi client ${account.getHost()}")
        val client = createClient(account.getHost(), account.getCredentials())
        workspaceApi = WorkspaceServiceClient(client)
        organizationApi = OrganizationServiceClient(client)
        userApi = UserServiceClient(client)
    }

    private val orgId: String
        get() = account?.organizationId ?: throw IllegalStateException("Organization not selected")

    suspend fun listOrganizations(): List<OrganizationOuterClass.Organization> {
        val organizationApi = organizationApi ?: throw IllegalStateException("No client")
        val resp = organizationApi.listOrganizations(OrganizationOuterClass.ListOrganizationsRequest.newBuilder().build())
        return this.handleResp("listOrganizations", resp).organizationsList
    }

    suspend fun createAndStartWorkspace(contextUrl: String, editor: String, workspaceClass: String, configurationId: String?): WorkspaceOuterClass.Workspace {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val meta = WorkspaceOuterClass.WorkspaceMetadata.newBuilder().setOrganizationId(orgId)
        if (configurationId != null) {
            meta.setConfigurationId(configurationId)
        }
        val contextInfo = WorkspaceOuterClass.CreateAndStartWorkspaceRequest.ContextURL.newBuilder()
            .setUrl(contextUrl)
            .setWorkspaceClass(workspaceClass)
            .setEditor(Editor.EditorReference.newBuilder().setName(editor).build())
        val req = WorkspaceOuterClass.CreateAndStartWorkspaceRequest.newBuilder()
            .setMetadata(meta)
            .setContextUrl(contextInfo)
        val resp = workspaceApi.createAndStartWorkspace(req.build())
        return this.handleResp("createWorkspace", resp).workspace
    }

    fun watchWorkspace(workspaceId: String?, consumer: (String, WorkspaceOuterClass.WorkspaceStatus) -> Unit): Job {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        return Utils.coroutineScope.launch {
            val req = WorkspaceOuterClass.WatchWorkspaceStatusRequest.newBuilder()
            if (!workspaceId.isNullOrEmpty()) {
                req.setWorkspaceId(workspaceId)
            }
            val stream = workspaceApi.watchWorkspaceStatus()
            stream.sendAndClose(req.build())
            val chan = stream.responseChannel()
            try {
                for (response in chan) {
                    consumer(response.workspaceId, response.status)
                }
            }
            finally {
                chan.cancel()
            }
        }
    }

    suspend fun listWorkspaces(): WorkspaceOuterClass.ListWorkspacesResponse {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val resp = workspaceApi.listWorkspaces(
            WorkspaceOuterClass.ListWorkspacesRequest.newBuilder().setOrganizationId(orgId).build()
        )
        return this.handleResp("listWorkspaces", resp)
    }

    suspend fun getWorkspace(workspaceId: String): WorkspaceOuterClass.GetWorkspaceResponse {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val resp = workspaceApi.getWorkspace(
            WorkspaceOuterClass.GetWorkspaceRequest.newBuilder().setWorkspaceId(workspaceId).build()
        )
        return this.handleResp("getWorkspace", resp)
    }

    suspend fun getWorkspaceOwnerToken(workspaceId: String): WorkspaceOuterClass.GetWorkspaceOwnerTokenResponse {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val resp = workspaceApi.getWorkspaceOwnerToken(
            WorkspaceOuterClass.GetWorkspaceOwnerTokenRequest.newBuilder().setWorkspaceId(workspaceId).build()
        )
        return this.handleResp("getWorkspaceOwnerToken", resp)
    }

    suspend fun getAuthenticatedUser(): UserOuterClass.User {
        return tryGetAuthenticatedUser(userApi, logger)
    }

    private fun <T> handleResp(method: String, resp: ResponseMessage<T>): T {
        val data = resp.success { it.message }
        val error = resp.failure {
            logger.error("failed to call papi.${method} $it")
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
                    host = "$gitpodHost/public-api",
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
        suspend fun tryGetAuthenticatedUser(api: UserServiceClientInterface?, logger: Logger): UserOuterClass.User {
            val userApi = api ?: throw IllegalStateException("No client")
            val resp = userApi.getAuthenticatedUser(UserOuterClass.GetAuthenticatedUserRequest.newBuilder().build())
            val user = resp.success { it.message.user }
            val err = resp.failure {
                logger.error("failed to call papi.getAuthenticatedUser $it")
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
