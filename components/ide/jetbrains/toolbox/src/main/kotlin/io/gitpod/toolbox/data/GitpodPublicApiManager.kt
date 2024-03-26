package io.gitpod.toolbox.data

import com.connectrpc.Interceptor
import com.connectrpc.ProtocolClientConfig
import com.connectrpc.StreamFunction
import com.connectrpc.UnaryFunction
import com.connectrpc.extensions.GoogleJavaProtobufStrategy
import com.connectrpc.http.clone
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import com.connectrpc.protocols.NetworkProtocol
import io.gitpod.publicapi.v1.WorkspaceServiceClient

class GitpodPublicApiManager {
    private val sharedClient = createClient("gitpod.io", "TODO: input your pat token here WITHOUT push to repo")

    val workspaceApi = WorkspaceServiceClient(sharedClient)

    fun getCurrentOrganizationId(): String {
        return "c5895528-23ac-4ebd-9d8b-464228d5755f" // id of gitpod.io/Gitpod
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
