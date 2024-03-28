package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.EnvironmentVisibilityState
import com.jetbrains.toolbox.gateway.RemoteProviderEnvironment
import com.jetbrains.toolbox.gateway.environments.EnvironmentContentsView
import com.jetbrains.toolbox.gateway.states.EnvironmentStateConsumer
import com.jetbrains.toolbox.gateway.states.StandardRemoteEnvironmentState
import com.jetbrains.toolbox.gateway.ui.ActionListener
import io.gitpod.publicapi.v1.WorkspaceOuterClass
import io.gitpod.toolbox.service.GitpodPublicApiManager
import okhttp3.OkHttpClient
import org.slf4j.LoggerFactory
import java.util.concurrent.CompletableFuture

class GitpodRemoteProviderEnvironment(
        private val workspace: WorkspaceOuterClass.Workspace,
        private val publicApi: GitpodPublicApiManager,
        private val httpClient: OkHttpClient,
) : RemoteProviderEnvironment {
    private val logger = LoggerFactory.getLogger(javaClass)
    private var viewState = StandardRemoteEnvironmentState.Inactive
    private val stateListeners = mutableSetOf<EnvironmentStateConsumer>()
    private val actionListeners = mutableSetOf<ActionListener>()

    init {
        if (workspace.status.phase.nameValue == WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_RUNNING_VALUE) {
            viewState = StandardRemoteEnvironmentState.Active
        }
    }

    override fun getId(): String = workspace.id
    override fun getName(): String = workspace.id

    override fun addStateListener(p0: EnvironmentStateConsumer?): Boolean {
        return if (p0 != null) {
            stateListeners += p0

            p0.consume(viewState)
            true
        } else false
    }

    override fun removeStateListener(p0: EnvironmentStateConsumer?) {
        if (p0 != null) {
            stateListeners -= p0
        }
    }

    override fun getContentsView(): CompletableFuture<EnvironmentContentsView> {
        return CompletableFuture.completedFuture(GitpodSSHEnvironmentContentsView(workspace.id, publicApi, httpClient, logger))
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
