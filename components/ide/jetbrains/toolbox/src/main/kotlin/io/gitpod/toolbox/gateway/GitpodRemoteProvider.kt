package io.gitpod.toolbox.gateway

import com.connectrpc.ResponseMessage
import com.jetbrains.toolbox.gateway.ProviderVisibilityState
import com.jetbrains.toolbox.gateway.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.gateway.RemoteProvider
import io.gitpod.publicapi.v1.WorkspaceOuterClass
import io.gitpod.publicapi.v1.WorkspaceOuterClass.ListWorkspacesRequest
import io.gitpod.toolbox.data.GitpodPublicApiManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.net.URI

class GitpodRemoteProvider(
    private val consumer: RemoteEnvironmentConsumer,
    coroutineScope: CoroutineScope,
) : RemoteProvider {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val publicApi = GitpodPublicApiManager()

    init {
        coroutineScope.launch {
            val workspaceList = publicApi.workspaceApi.listWorkspaces(ListWorkspacesRequest.newBuilder().setOrganizationId(publicApi.getCurrentOrganizationId()).build())
            workspaceList.success {list: ResponseMessage.Success<WorkspaceOuterClass.ListWorkspacesResponse> ->
                consumer.consumeEnvironments(list.message.workspacesList.map { GitpodRemoteProviderEnvironment(it) })
            }
            workspaceList.failure { error: ResponseMessage.Failure<WorkspaceOuterClass.ListWorkspacesResponse> ->
                logger.error("Failed to retrieve workspaces: ${error.toString()}")
            }
        }
    }

    override fun close() {}

    override fun getName(): String = "Gitpod"
    override fun getSvgIcon(): ByteArray {
        return this::class.java.getResourceAsStream("/icon.svg")?.readAllBytes() ?: byteArrayOf()
    }

    override fun canCreateNewEnvironments(): Boolean = true
    override fun isSingleEnvironment(): Boolean = false

    override fun setVisible(visibilityState: ProviderVisibilityState) {}

    override fun addEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}
    override fun removeEnvironmentsListener(listener: RemoteEnvironmentConsumer) {}

    override fun handleUri(uri: URI) {
        logger.debug("External request: {}", uri)
    }
}
