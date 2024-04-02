package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.EnvironmentVisibilityState
import com.jetbrains.toolbox.gateway.RemoteProviderEnvironment
import com.jetbrains.toolbox.gateway.environments.EnvironmentContentsView
import com.jetbrains.toolbox.gateway.states.EnvironmentStateConsumer
import com.jetbrains.toolbox.gateway.states.StandardRemoteEnvironmentState
import com.jetbrains.toolbox.gateway.ui.ActionListener
import io.gitpod.publicapi.v1.WorkspaceOuterClass
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import org.slf4j.LoggerFactory
import java.util.concurrent.CompletableFuture

class GitpodRemoteProviderEnvironment(
    private val authManager: GitpodAuthManager,
    private val workspace: WorkspaceOuterClass.Workspace,
    private val publicApi: GitpodPublicApiManager,
    private val httpClient: OkHttpClient,
) : RemoteProviderEnvironment {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val stateListeners = mutableSetOf<EnvironmentStateConsumer>()
    private val actionListeners = mutableSetOf<ActionListener>()

    init {
        Utils.coroutineScope.launch {
            publicApi.watchWorkspace(workspace.id) { _, status ->
                var state = StandardRemoteEnvironmentState.Inactive
                when (status.phase.nameValue) {
                    WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_IMAGEBUILD_VALUE,
                    WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_INITIALIZING_VALUE,
                    WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_PENDING_VALUE,
                    WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_CREATING_VALUE -> {
                        state = StandardRemoteEnvironmentState.Unreachable
                    }

                    WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_STOPPING_VALUE,
                    WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_STOPPED_VALUE -> {
                        state = StandardRemoteEnvironmentState.Inactive
                    }

                    WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_RUNNING_VALUE -> {
                        state = StandardRemoteEnvironmentState.Active
                    }
                }
                stateListeners.forEach { it.consume(state) }
            }
        }
    }

    override fun getId(): String = workspace.id
    override fun getName(): String = workspace.metadata.name

    override fun addStateListener(p0: EnvironmentStateConsumer?): Boolean {
        return if (p0 != null) {
            stateListeners += p0
            true
        } else false
    }

    override fun removeStateListener(p0: EnvironmentStateConsumer?) {
        if (p0 != null) {
            stateListeners -= p0
        }
    }

    override fun getContentsView(): CompletableFuture<EnvironmentContentsView> {
        return CompletableFuture.completedFuture(
            GitpodSSHEnvironmentContentsView(
                authManager,
                workspace.id,
                publicApi,
                httpClient,
            )
        )
    }

    override fun setVisible(visibilityState: EnvironmentVisibilityState) {
    }

    override fun registerActionListener(p0: ActionListener) {
        actionListeners += p0
    }

    override fun unregisterActionListener(p0: ActionListener) {
        actionListeners -= p0
    }
}
