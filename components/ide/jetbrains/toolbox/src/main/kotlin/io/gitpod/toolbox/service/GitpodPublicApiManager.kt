package io.gitpod.toolbox.service

import com.connectrpc.*
import com.connectrpc.extensions.GoogleJavaProtobufStrategy
import com.connectrpc.http.clone
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import com.connectrpc.protocols.NetworkProtocol
import io.gitpod.publicapi.v1.*
import io.gitpod.toolbox.auth.GitpodAuthManager
import org.slf4j.LoggerFactory

class GitpodPublicApiManager(authManger: GitpodAuthManager) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private var workspaceApi: WorkspaceServiceClientInterface? = null
    private var userApi: UserServiceClientInterface? = null

    init {
        authManger.addLoginListener {
            val account = authManger.getCurrentAccount() ?: return@addLoginListener
            val client = createClient(account.getHost(), account.getCredentials())
            workspaceApi = WorkspaceServiceClient(client)
            userApi = UserServiceClient(client)
        }
        authManger.addLogoutListener {
            workspaceApi = null
            userApi = null
        }
    }

    fun getCurrentOrganizationId(): String {
        return "c5895528-23ac-4ebd-9d8b-464228d5755f"
    }

    suspend fun listWorkspaces(organizationId: String): WorkspaceOuterClass.ListWorkspacesResponse {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val respMessage = workspaceApi.listWorkspaces(WorkspaceOuterClass.ListWorkspacesRequest.newBuilder().setOrganizationId(organizationId).build())
        val resp = respMessage.success { list: ResponseMessage.Success<WorkspaceOuterClass.ListWorkspacesResponse> ->
            list.message
        }
        val error = respMessage.failure { error: ResponseMessage.Failure<WorkspaceOuterClass.ListWorkspacesResponse> ->
            logger.error("Failed calling listWorkspaces: ${error.toString()}")
            error.cause
        }
        if (resp != null) {
            return resp
        }
        throw error!!
    }

    suspend fun getWorkspace(workspaceId: String): WorkspaceOuterClass.GetWorkspaceResponse {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val respMessage = workspaceApi.getWorkspace(WorkspaceOuterClass.GetWorkspaceRequest.newBuilder().setWorkspaceId(workspaceId).build())
        val resp = respMessage.success { list: ResponseMessage.Success<WorkspaceOuterClass.GetWorkspaceResponse> ->
            list.message
        }
        val error = respMessage.failure { error: ResponseMessage.Failure<WorkspaceOuterClass.GetWorkspaceResponse> ->
            logger.error("Failed calling getWorkspace: ${error.toString()}")
            error.cause
        }
        if (resp != null) {
            return resp
        }
        throw error!!
    }

    suspend fun getWorkspaceOwnerToken(workspaceId: String): WorkspaceOuterClass.GetWorkspaceOwnerTokenResponse {
        val workspaceApi = workspaceApi ?: throw IllegalStateException("No client")
        val respMessage = workspaceApi.getWorkspaceOwnerToken(WorkspaceOuterClass.GetWorkspaceOwnerTokenRequest.newBuilder().setWorkspaceId(workspaceId).build())
        val resp = respMessage.success { list: ResponseMessage.Success<WorkspaceOuterClass.GetWorkspaceOwnerTokenResponse> ->
            list.message
        }
        val error = respMessage.failure { error: ResponseMessage.Failure<WorkspaceOuterClass.GetWorkspaceOwnerTokenResponse> ->
            logger.error("Failed calling getWorkspaceOwnerToken: ${error.toString()}")
            error.cause
        }
        if (resp != null) {
            return resp
        }
        throw error!!
    }

    suspend fun getAuthenticatedUser(): UserOuterClass.User {
        return tryGetAuthenticatedUser(userApi)
    }

    companion object {
        fun createClient(gitpodHost: String, token: String): ProtocolClient {
            val authInterceptor = AuthorizationInterceptor(token)
            return ProtocolClient(
                    httpClient = ConnectOkHttpClient(),
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
        suspend fun tryGetAuthenticatedUser(api: UserServiceClientInterface?): UserOuterClass.User {
            val userApi = api ?: throw IllegalStateException("No client")
            val resp = userApi.getAuthenticatedUser(UserOuterClass.GetAuthenticatedUserRequest.newBuilder().build())
            val user = resp.success { it.message.user }
            val err = resp.failure {
                it.cause
            }
            return user ?: throw err!!
        }
    }
}

class AuthorizationInterceptor(private val token: String) : Interceptor {
    override fun streamFunction(): StreamFunction {
        return StreamFunction(
                requestFunction = { request ->
                    val headers = mutableMapOf<String, List<String>>()
                    headers.putAll(request.headers)
                    headers["Authorization"] = listOf("Bearer $token")
                    return@StreamFunction request.clone(headers = headers)
                },
        )
    }

    override fun unaryFunction(): UnaryFunction {
        return UnaryFunction(
                requestFunction = { request ->
                    val headers = mutableMapOf<String, List<String>>()
                    headers.putAll(request.headers)
                    headers["Authorization"] = listOf("Bearer $token")
                    return@UnaryFunction request.clone(headers = headers)
                },
                responseFunction = { resp ->
                    resp
                },
        )
    }
}

// TODO: logger interceptor