// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.AbstractRemoteProviderEnvironment
import com.jetbrains.toolbox.gateway.EnvironmentVisibilityState
import com.jetbrains.toolbox.gateway.environments.EnvironmentContentsView
import com.jetbrains.toolbox.gateway.states.EnvironmentStateConsumer
import com.jetbrains.toolbox.gateway.states.StandardRemoteEnvironmentState
import com.jetbrains.toolbox.gateway.ui.ActionDescription
import com.jetbrains.toolbox.gateway.ui.ObservableList
import com.jetbrains.toolbox.gateway.ui.ObservablePropertiesFactory
import io.gitpod.publicapi.experimental.v1.Workspaces.WorkspaceInstanceStatus
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.service.ConnectParams
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import io.gitpod.toolbox.utils.GitpodLogger
import kotlinx.coroutines.DisposableHandle
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import java.util.concurrent.CompletableFuture

class GitpodRemoteProviderEnvironment(
    private val authManager: GitpodAuthManager,
    private val connectParams: ConnectParams,
    private val publicApi: GitpodPublicApiManager, observablePropertiesFactory: ObservablePropertiesFactory?,
) : AbstractRemoteProviderEnvironment(observablePropertiesFactory), DisposableHandle {
    private val actionList = Utils.observablePropertiesFactory.emptyObservableList<ActionDescription>();
    private val contentsViewFuture: CompletableFuture<EnvironmentContentsView> = CompletableFuture.completedFuture(
        GitpodSSHEnvironmentContentsView(
            authManager,
            connectParams,
            publicApi,
        )
    )
    private var watchWorkspaceJob: Job? = null

    private val lastWSEnvState = MutableSharedFlow<WorkspaceEnvState>(1, 0, BufferOverflow.DROP_OLDEST)
    private var lastPhase: WorkspaceInstanceStatus.Phase = WorkspaceInstanceStatus.Phase.PHASE_UNSPECIFIED

    init {
        Utils.coroutineScope.launch {
            lastWSEnvState.collect { lastState ->
                val state = lastState.getState()
                val actions = mutableListOf<ActionDescription>()
                actionList.clear()
                actionList.addAll(actions)
                listenerSet.forEach { it.consume(state) }
            }
        }

        Utils.coroutineScope.launch {
            GitpodLogger.debug("watching workspace ${connectParams.workspaceId}")
            watchWorkspaceJob = publicApi.watchWorkspaceStatus(connectParams.workspaceId) { _, status ->
                lastPhase = status.phase
                GitpodLogger.debug("${connectParams.workspaceId} status updated: $lastPhase")
                lastWSEnvState.tryEmit(WorkspaceEnvState(status.phase))
            }
        }
    }

    override fun addStateListener(consumer: EnvironmentStateConsumer): Boolean {
        val ok = super.addStateListener(consumer)
        Utils.coroutineScope.launch {
            lastWSEnvState.tryEmit(WorkspaceEnvState(lastPhase))
        }
        return ok
    }

    override fun getId(): String = connectParams.uniqueID
    override fun getName(): String = connectParams.resolvedWorkspaceId

    override fun getContentsView(): CompletableFuture<EnvironmentContentsView> = contentsViewFuture

    override fun setVisible(visibilityState: EnvironmentVisibilityState) {
    }

    override fun getActionList(): ObservableList<ActionDescription> = actionList

    override fun dispose() {
        watchWorkspaceJob?.cancel()
    }
}


private class WorkspaceEnvState(val phase: WorkspaceInstanceStatus.Phase) {

    fun getState() = run {
        phaseToStateMap[phase] ?: StandardRemoteEnvironmentState.Unreachable
    }

    companion object {
        val phaseToStateMap = mapOf(
            WorkspaceInstanceStatus.Phase.PHASE_UNSPECIFIED to StandardRemoteEnvironmentState.Unreachable,
            WorkspaceInstanceStatus.Phase.PHASE_PREPARING to StandardRemoteEnvironmentState.Initializing,
            WorkspaceInstanceStatus.Phase.PHASE_IMAGEBUILD to StandardRemoteEnvironmentState.Initializing,
            WorkspaceInstanceStatus.Phase.PHASE_PENDING to StandardRemoteEnvironmentState.Initializing,
            WorkspaceInstanceStatus.Phase.PHASE_CREATING to StandardRemoteEnvironmentState.Initializing,
            WorkspaceInstanceStatus.Phase.PHASE_INITIALIZING to StandardRemoteEnvironmentState.Initializing,
            WorkspaceInstanceStatus.Phase.PHASE_RUNNING to StandardRemoteEnvironmentState.Active,
            WorkspaceInstanceStatus.Phase.PHASE_INTERRUPTED to StandardRemoteEnvironmentState.Error,
            WorkspaceInstanceStatus.Phase.PHASE_STOPPING to StandardRemoteEnvironmentState.Unreachable,
            WorkspaceInstanceStatus.Phase.PHASE_STOPPED to StandardRemoteEnvironmentState.Hibernated,
        )
    }
}