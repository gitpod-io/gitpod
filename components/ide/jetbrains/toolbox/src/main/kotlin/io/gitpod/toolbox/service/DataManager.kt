// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import io.gitpod.publicapi.v1.WorkspaceOuterClass
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.slf4j.LoggerFactory
import java.net.SocketTimeoutException

class DataManager {
    val sharedWorkspaceList = MutableSharedFlow<List<WorkspaceOuterClass.Workspace>>(1, 0, BufferOverflow.DROP_OLDEST)
    private val logger = LoggerFactory.getLogger(javaClass)

    private var workspaceList = listOf<WorkspaceOuterClass.Workspace>()
    private val workspaceStatusListeners = mutableListOf<(String, WorkspaceOuterClass.WorkspaceStatus) -> Unit>()


    init {
        Utils.coroutineScope.launch {
            sharedWorkspaceList.collect {
                workspaceList = it
            }
        }
    }

    private var watchWorkspaceStatusJob: Job? = null
    private val watchWorkspaceStatusMutex = Mutex()
    fun startWatchWorkspaces(publicApi: GitpodPublicApiManager) {
        Utils.coroutineScope.launch {
            watchWorkspaceStatusMutex.withLock {
                try {
                    publicApi.listWorkspaces().let {
                        sharedWorkspaceList.tryEmit(it.workspacesList)
                    }
                    watchWorkspaceStatusJob?.cancel()
                    watchWorkspaceStatusJob = publicApi.watchWorkspace(null) { workspaceId, status ->
                        val found = workspaceList.find { it.id == workspaceId }
                        if (found != null) {
                            val newList = workspaceList.map {
                                if (it.id == workspaceId) {
                                    it.toBuilder().setStatus(status).build()
                                } else {
                                    it
                                }
                            }
                            sharedWorkspaceList.tryEmit(newList)
                        } else {
                            Utils.coroutineScope.launch {
                                publicApi.listWorkspaces().let {
                                    sharedWorkspaceList.tryEmit(it.workspacesList)
                                }
                            }
                        }
                        workspaceStatusListeners.forEach{ it(workspaceId, status)}
                    }
                } catch (e: SocketTimeoutException) {
                    startWatchWorkspaces(publicApi)
                } catch (e: Exception) {
                    logger.error("Error in startWatchWorkspaces", e)
                }
            }
        }
    }

    /**
     * watchWorkspaceStatus locally to save server load
     */
    fun watchWorkspaceStatus(workspaceId: String, consumer: (WorkspaceOuterClass.WorkspaceStatus) -> Unit) {
        workspaceList.find { it.id == workspaceId }?.let {
            consumer(it.status)
        }
        workspaceStatusListeners.add { wsId, status ->
            if (wsId == workspaceId) {
                consumer(status)
            }
        }
    }
}
