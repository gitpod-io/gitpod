package io.gitpod.toolbox.data

import com.connectrpc.*
import com.connectrpc.extensions.GoogleJavaProtobufStrategy
import com.connectrpc.http.clone
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import com.connectrpc.protocols.NetworkProtocol
import io.gitpod.publicapi.v1.*
import io.gitpod.toolbox.auth.GitpodAccount
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.gateway.GitpodRemoteProviderEnvironment
import org.slf4j.Logger
import org.slf4j.LoggerFactory

class GitpodPublicApiManager {
    private val logger = LoggerFactory.getLogger(javaClass)
    private var sharedClient: ProtocolClient? = null
    private var workspaceApi: WorkspaceServiceClientInterface? = null
    private var userApi: UserServiceClientInterface? = null

    private var tmpKey: String = ""

    fun getCurrentOrganizationId(): String {
        return "c5895528-23ac-4ebd-9d8b-464228d5755f"
    }

    fun setAccount(host: String, authHeader: String) {
        val key = "$host:$authHeader"
        if (tmpKey == key) {
            return
        }
        tmpKey = key
        sharedClient = createClient(host, authHeader)
        workspaceApi = WorkspaceServiceClient(sharedClient!!)
        userApi = UserServiceClient(sharedClient!!)
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
        val userApi = userApi ?: throw IllegalStateException("No client")
        val resp = userApi.getAuthenticatedUser(UserOuterClass.GetAuthenticatedUserRequest.newBuilder().build())
        val user = resp.success { it.message.user }
        val err = resp.failure {
            logger.error("Failed calling getAuthenticatedUser: $it")
            it.cause
        }
        return user ?: throw err!!
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
    }
}

class AuthorizationInterceptor(private val token: String) : Interceptor {
    override fun streamFunction(): StreamFunction {
        return StreamFunction(
                requestFunction = { request ->
                    val headers = mutableMapOf<String, List<String>>()
                    headers.putAll(request.headers)
                    headers["Authorization"] = listOf(token)
                    return@StreamFunction request.clone(headers = headers)
                },
        )
    }

    override fun unaryFunction(): UnaryFunction {
        return UnaryFunction(
                requestFunction = { request ->
                    val headers = mutableMapOf<String, List<String>>()
                    headers.putAll(request.headers)
                    headers["Authorization"] = listOf(token)
                    return@UnaryFunction request.clone(headers = headers)
                },
                responseFunction = { resp ->
                    resp
                },
        )
    }
}
