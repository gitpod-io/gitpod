// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.services

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import io.gitpod.gitpodprotocol.api.entities.SendHeartBeatOptions
import io.gitpod.jetbrains.remote.GitpodManager
import io.gitpod.jetbrains.remote.services.ControllerStatusService.ControllerStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.future.await
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.random.Random.Default.nextInt

@Service
class HeartbeatService : Disposable {

    private val manager = service<GitpodManager>()

    // define property to store successfulCount and totalCount
    private var successfulCount = 0
    private var totalCount = 0
    private val counterMutex = Mutex()

    private val job = GlobalScope.launch {
        val info = manager.pendingInfo.await()
        val intervalInSeconds = 30
        var current = ControllerStatus(
                connected = false,
                secondsSinceLastActivity = 0
        )
        while (isActive) {
            var hbSucceed = false
            try {
                val previous = current;
                current = ControllerStatusService.fetch()

                val maxIntervalInSeconds = intervalInSeconds + nextInt(5, 15)
                val wasClosed: Boolean? = when {
                    current.connected != previous.connected -> !current.connected
                    current.connected && current.secondsSinceLastActivity <= maxIntervalInSeconds -> false
                    else -> null
                }
                if (wasClosed != null) {
                    manager.client.server.sendHeartBeat(SendHeartBeatOptions(info.instanceId, wasClosed)).await()
                    hbSucceed = true
                    if (wasClosed) {
                        manager.trackEvent("ide_close_signal", mapOf(
                                "clientKind" to "jetbrains"
                        ))
                    }
                }
            } catch (t: Throwable) {
                thisLogger().error("gitpod: failed to check activity:", t)
            } finally {
                counterMutex.withLock {
                    if (hbSucceed) {
                        successfulCount += 1
                    }
                    totalCount += 1
                }
            }

            delay(intervalInSeconds * 1000L)
        }
    }

    // define job to start interval per 15 minutes
    private val telemetryJob = GlobalScope.launch {
        try {
            while (isActive) {
                sendIDEHeartbeat()
                delay(15 * 60 * 1000L)
            }
        } finally {
            sendIDEHeartbeat()
        }
    }

    private suspend fun sendIDEHeartbeat() {
        try {
            var props: Map<String, Any> = mapOf()
            val info = manager.pendingInfo.await()
            counterMutex.withLock {
                props = mapOf(
                        "clientKind" to "jetbrains",
                        "totalCount" to totalCount,
                        "successfulCount" to successfulCount,
                        "gitpodHost" to info.gitpodApi.host,
                        // TODO: Identify if it's debug workspace
                        // "debugWorkspace" to "false"
                )
                totalCount = 0
                successfulCount = 0
            }
            manager.trackEvent("ide_heartbeat", props)
        } catch (t: Throwable) {
            thisLogger().error("gitpod: failed to send heartbeat telemetry:", t)
        }
    }

    override fun dispose() {
        job.cancel()
        telemetryJob.cancel()
    }
}
