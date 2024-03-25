package toolbox.gateway.sample.io.gitpod.toolbox

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
    private val sharedClient = createClient("gitpod.io", System.getenv("GP_PAT_TOKEN"))

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
        TODO("Not yet implemented")
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
