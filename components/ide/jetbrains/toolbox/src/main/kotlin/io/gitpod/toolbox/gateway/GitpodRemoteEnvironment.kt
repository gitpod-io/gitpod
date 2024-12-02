// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.api.remoteDev.AbstractRemoteProviderEnvironment
import com.jetbrains.toolbox.api.remoteDev.EnvironmentVisibilityState
import com.jetbrains.toolbox.api.remoteDev.environments.EnvironmentContentsView
import com.jetbrains.toolbox.api.remoteDev.states.CustomRemoteEnvironmentState
import com.jetbrains.toolbox.api.remoteDev.states.EnvironmentStateConsumer
import com.jetbrains.toolbox.api.remoteDev.states.EnvironmentStateIcons
import com.jetbrains.toolbox.api.remoteDev.states.StandardRemoteEnvironmentState
import com.jetbrains.toolbox.api.ui.actions.ActionDescription
import com.jetbrains.toolbox.api.ui.observables.ObservableList
import com.jetbrains.toolbox.api.ui.observables.ObservablePropertiesFactory
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

class GitpodRemoteEnvironment(
    private val authManager: GitpodAuthManager,
    private val connectParams: ConnectParams,
    private val publicApi: GitpodPublicApiManager, observablePropertiesFactory: ObservablePropertiesFactory?,
) : AbstractRemoteProviderEnvironment(observablePropertiesFactory), DisposableHandle {
    private val actionList = Utils.observablePropertiesFactory.emptyObservableList<ActionDescription>();
    private val envContentsView = GitpodRemoteEnvironmentContentsView(connectParams, publicApi)
    private val contentsViewFuture: CompletableFuture<EnvironmentContentsView> =
        CompletableFuture.completedFuture(envContentsView)
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
                Utils.coroutineScope.launch {
                    envContentsView.updateEnvironmentMeta(status)
                }
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
    override fun getName(): String = connectParams.uniqueID

    override fun getContentsView(): CompletableFuture<EnvironmentContentsView> = contentsViewFuture

    override fun setVisible(visibilityState: EnvironmentVisibilityState) {
    }

    override fun getActionList(): ObservableList<ActionDescription> = actionList

    override fun onDelete() {
        // TODO: delete workspace?
        watchWorkspaceJob?.cancel()
    }

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
            WorkspaceInstanceStatus.Phase.PHASE_UNSPECIFIED to CustomRemoteEnvironmentState("Unknown", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Inactive), false, EnvironmentStateIcons.Error),
            WorkspaceInstanceStatus.Phase.PHASE_PREPARING to CustomRemoteEnvironmentState("Preparing", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Initializing), false, EnvironmentStateIcons.Connecting),
            WorkspaceInstanceStatus.Phase.PHASE_IMAGEBUILD to CustomRemoteEnvironmentState("Building", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Initializing), false, EnvironmentStateIcons.Connecting),
            WorkspaceInstanceStatus.Phase.PHASE_PENDING to CustomRemoteEnvironmentState("Initializing", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Initializing), false, EnvironmentStateIcons.Connecting),
            WorkspaceInstanceStatus.Phase.PHASE_CREATING to CustomRemoteEnvironmentState("Creating", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Initializing), false, EnvironmentStateIcons.Connecting),
            WorkspaceInstanceStatus.Phase.PHASE_INITIALIZING to CustomRemoteEnvironmentState("Initializing", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Initializing), false, EnvironmentStateIcons.Connecting),
            WorkspaceInstanceStatus.Phase.PHASE_RUNNING to CustomRemoteEnvironmentState("Running", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Active), true, EnvironmentStateIcons.Active),
            WorkspaceInstanceStatus.Phase.PHASE_INTERRUPTED to StandardRemoteEnvironmentState.Error,
            WorkspaceInstanceStatus.Phase.PHASE_STOPPING to CustomRemoteEnvironmentState("Stopping", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Hibernating), false, EnvironmentStateIcons.Connecting),
            WorkspaceInstanceStatus.Phase.PHASE_STOPPED to CustomRemoteEnvironmentState("Stopped", Utils.environmentStateColorPalette.getColor(StandardRemoteEnvironmentState.Hibernated), false, EnvironmentStateIcons.Hibernated),
        )
    }
}
