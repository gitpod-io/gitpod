// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.remoteDev.util.onTerminationOrNow
import com.jetbrains.rd.util.CopyOnWriteArrayList
import com.jetbrains.rd.util.concurrentMapOf
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.lifetime.LifetimeDefinition
import io.gitpod.gitpodprotocol.api.GitpodClient
import io.gitpod.gitpodprotocol.api.entities.WorkspaceInfo
import io.gitpod.gitpodprotocol.api.entities.WorkspaceInstance
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.future.await
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class GatewayGitpodClient(
    private val lifetimeDefinition: LifetimeDefinition, private val gitpodHost: String
) : GitpodClient() {

    private val mutex = Mutex()

    private val listeners = concurrentMapOf<String, CopyOnWriteArrayList<Channel<WorkspaceInstance>>?>()

    private val timeoutDelayInMinutes = 15
    private var timeoutJob: Job? = null;

    init {
        GlobalScope.launch {
            mutex.withLock {
                scheduleTimeout("waiting for workspace listeners")
            }
        }
    }

    private fun scheduleTimeout(reason: String) {
        if (timeoutJob?.isActive == true) {
            return
        }
        timeoutJob = GlobalScope.launch {
            thisLogger().info("$gitpodHost: connection times out in $timeoutDelayInMinutes minutes: $reason")
            delay(timeoutDelayInMinutes * 60 * 1000L)
            if (isActive) {
                lifetimeDefinition.terminate()
            }
        }
    }

    private fun cancelTimeout(reason: String) {
        if (timeoutJob?.isActive == true) {
            thisLogger().info("$gitpodHost: canceled connection timeout: $reason")
            timeoutJob!!.cancel()
        }
    }

    private var syncJob: Job? = null;
    override fun notifyConnect() {
        syncJob?.cancel()
        syncJob = GlobalScope.launch {
            for (id in listeners.keys) {
                ensureActive()
                if (id == "*") {
                    continue
                }
                try {
                    syncWorkspace(id);
                } catch (t: Throwable) {
                    thisLogger().error("${gitpodHost}: ${id}: failed to sync", t)
                }
            }
        }
    }

    override fun onInstanceUpdate(instance: WorkspaceInstance?) {
        if (instance == null) {
            return;
        }
        GlobalScope.launch {
            val wsListeners = listeners[instance.workspaceId] ?: return@launch
            for (listener in wsListeners) {
                listener.send(instance)
            }
        }
        GlobalScope.launch {
            val anyListeners = listeners["*"] ?: return@launch
            for (listener in anyListeners) {
                listener.send(instance)
            }
        }
    }

    suspend fun listenToWorkspace(
        listenerLifetime: Lifetime,
        workspaceId: String
    ): ReceiveChannel<WorkspaceInstance> {
        val listener = Channel<WorkspaceInstance>()
        mutex.withLock {
            val listeners = this.listeners.getOrPut(workspaceId) { CopyOnWriteArrayList() }!!
            listeners.add(listener);
            cancelTimeout("listening to workspace: $workspaceId")
        }
        listenerLifetime.onTerminationOrNow {
            listener.close()
            GlobalScope.launch {
                removeListener(workspaceId, listener)
            }
        }
        return listener
    }

    private suspend fun removeListener(workspaceId: String, listener: Channel<WorkspaceInstance>) {
        mutex.withLock {
            val listeners = this.listeners[workspaceId]
            if (listeners.isNullOrEmpty()) {
                return
            }
            listeners.remove(listener);
            if (listeners.isNotEmpty()) {
                return
            }
            this.listeners.remove(workspaceId)
            if (this.listeners.isNotEmpty()) {
                return
            }
            scheduleTimeout("no workspace listeners")
        }
    }

    suspend fun syncWorkspace(id: String): WorkspaceInfo {
        val info = server.getWorkspace(id).await()
        onInstanceUpdate(info.latestInstance)
        return info
    }

}