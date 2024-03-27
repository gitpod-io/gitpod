package io.gitpod.toolbox.data

import com.connectrpc.*
import com.connectrpc.extensions.GoogleJavaProtobufStrategy
import com.connectrpc.http.clone
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import com.connectrpc.protocols.NetworkProtocol
import io.gitpod.publicapi.v1.WorkspaceOuterClass
import io.gitpod.publicapi.v1.WorkspaceServiceClient
import io.gitpod.toolbox.gateway.GitpodRemoteProviderEnvironment
import org.slf4j.Logger

class GitpodPublicApiManager(
        private val logger: Logger
) {
    private val sharedClient = createClient("gitpod.io", "bar")

    private val workspaceApi = WorkspaceServiceClient(sharedClient)

    fun getCurrentOrganizationId(): String {
        return "c5895528-23ac-4ebd-9d8b-464228d5755f" // id of gitpod.io/Gitpod
    }

    suspend fun listWorkspaces(organizationId: String): WorkspaceOuterClass.ListWorkspacesResponse {
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

    companion object {
        fun createClient(gitpodHost: String, token: String): ProtocolClient {
            val authInterceptor = AuthorizationInterceptor(token)
            return ProtocolClient(
                    httpClient = ConnectOkHttpClient(),
                    ProtocolClientConfig(
                            host = "https://$gitpodHost/public-api",
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
