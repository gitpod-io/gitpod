// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.AbstractRemoteProviderEnvironment
import com.jetbrains.toolbox.gateway.EnvironmentVisibilityState
import com.jetbrains.toolbox.gateway.environments.EnvironmentContentsView
import com.jetbrains.toolbox.gateway.states.StandardRemoteEnvironmentState
import com.jetbrains.toolbox.gateway.ui.ActionDescription
import com.jetbrains.toolbox.gateway.ui.ObservableList
import io.gitpod.publicapi.v1.WorkspaceOuterClass
import io.gitpod.publicapi.v1.WorkspaceOuterClass.WorkspacePhase
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.util.concurrent.CompletableFuture

class GitpodRemoteProviderEnvironment(
    private val authManager: GitpodAuthManager,
    private val workspaceId: String,
    private val publicApi: GitpodPublicApiManager,
) : AbstractRemoteProviderEnvironment() {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val actionList = Utils.observablePropertiesFactory.emptyObservableList<ActionDescription>();
    private val contentsViewFuture: CompletableFuture<EnvironmentContentsView> = CompletableFuture.completedFuture(
        GitpodSSHEnvironmentContentsView(
            authManager,
            workspaceId,
            publicApi,
        )
    )

    private val lastWSEnvState = MutableSharedFlow<WorkspaceEnvState>(1, 0, BufferOverflow.DROP_OLDEST)
    private var lastPhase: WorkspacePhase =
        WorkspacePhase.newBuilder().setNameValue(WorkspacePhase.Phase.PHASE_UNSPECIFIED_VALUE).build()
    private var isMarkActive = false
        set(value) {
            if (field != value) {
                field = value
                lastWSEnvState.tryEmit(WorkspaceEnvState(lastPhase, value))
            }
        }

    fun markActive() {
        isMarkActive = true
    }

    init {
        logger.info("==================GitpodRemoteProviderEnvironment.init $workspaceId")
        Utils.coroutineScope.launch {
            Utils.dataManager.watchWorkspaceStatus(workspaceId) {
                lastPhase = it.phase
                lastWSEnvState.tryEmit(WorkspaceEnvState(it.phase, isMarkActive))
            }
        }

        Utils.coroutineScope.launch {
            lastWSEnvState.collect { lastState ->
                val state = lastState.getState()
                val actions = mutableListOf<ActionDescription>()
                if (lastState.isConnectable) {
                    actions += SimpleButton("Connect") {
                        isMarkActive = true
                    }
                }
                if (lastState.isCloseable) {
                    actions += SimpleButton("Close") {
                        isMarkActive = false
                        Utils.coroutineScope.launch { contentsViewFuture.get().close() }
                    }
                }
                if (lastState.isStoppable) {
                    actions += SimpleButton("Stop workspace") {
                        logger.info("===============stop workspace clicked")
                    }
                }
                actionList.clear()
                actionList.addAll(actions)
                listenerSet.forEach { it.consume(state) }
            }
        }
    }

    override fun getId(): String = workspaceId
    override fun getName(): String = workspaceId

    override fun getContentsView(): CompletableFuture<EnvironmentContentsView> = contentsViewFuture

    override fun setVisible(visibilityState: EnvironmentVisibilityState) {

    }

    override fun getActionList(): ObservableList<ActionDescription> = actionList
}


private class WorkspaceEnvState(val phase: WorkspacePhase, val isMarkActive: Boolean) {
    val isConnectable = phase.nameValue == WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_RUNNING_VALUE && !isMarkActive
    val isCloseable = isMarkActive
    val isStoppable = phase.nameValue == WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_RUNNING_VALUE

    fun getState() = run {
        if (isMarkActive && phase.nameValue == WorkspaceOuterClass.WorkspacePhase.Phase.PHASE_RUNNING_VALUE) {
            StandardRemoteEnvironmentState.Active
        } else {
            phaseToStateMap[phase.nameValue] ?: StandardRemoteEnvironmentState.Unreachable
        }
    }

    companion object {
        val phaseToStateMap = mapOf(
            WorkspacePhase.Phase.PHASE_UNSPECIFIED_VALUE to StandardRemoteEnvironmentState.Unreachable,
            WorkspacePhase.Phase.PHASE_PREPARING_VALUE to StandardRemoteEnvironmentState.Unreachable,
            WorkspacePhase.Phase.PHASE_IMAGEBUILD_VALUE to StandardRemoteEnvironmentState.Unreachable,
            WorkspacePhase.Phase.PHASE_PENDING_VALUE to StandardRemoteEnvironmentState.Unreachable,
            WorkspacePhase.Phase.PHASE_CREATING_VALUE to StandardRemoteEnvironmentState.Unreachable,
            WorkspacePhase.Phase.PHASE_INITIALIZING_VALUE to StandardRemoteEnvironmentState.Unreachable,
            WorkspacePhase.Phase.PHASE_RUNNING_VALUE to StandardRemoteEnvironmentState.Inactive,
            WorkspacePhase.Phase.PHASE_INTERRUPTED_VALUE to StandardRemoteEnvironmentState.Error,
            WorkspacePhase.Phase.PHASE_PAUSED_VALUE to StandardRemoteEnvironmentState.Inactive,
            WorkspacePhase.Phase.PHASE_STOPPING_VALUE to StandardRemoteEnvironmentState.Inactive,
            WorkspacePhase.Phase.PHASE_STOPPED_VALUE to StandardRemoteEnvironmentState.Inactive
        )
    }
}
