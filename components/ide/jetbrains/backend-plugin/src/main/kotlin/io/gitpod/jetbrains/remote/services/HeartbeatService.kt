// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.services

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.extensions.PluginId
import io.gitpod.gitpodprotocol.api.GitpodClient
import io.gitpod.gitpodprotocol.api.GitpodServerLauncher
import io.gitpod.gitpodprotocol.api.entities.SendHeartBeatOptions
import io.gitpod.jetbrains.remote.services.ControllerStatusService.ControllerStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.future.await
import javax.websocket.DeploymentException
import kotlin.coroutines.coroutineContext
import kotlin.random.Random.Default.nextInt

@Service
class HeartbeatService : Disposable {

    private val job = GlobalScope.launch {
        val info = SupervisorInfoService.fetch()
        val client = GitpodClient()
        val launcher = GitpodServerLauncher.create(client)
        launch {
            connectToServer(info, launcher)
        }
        val intervalInSeconds = 30
        var current = ControllerStatus(
            connected = false,
            secondsSinceLastActivity = 0
        )
        while (isActive) {
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
                    client.server.sendHeartBeat(SendHeartBeatOptions(info.infoResponse.instanceId, wasClosed)).await()
                }
            } catch (t: Throwable) {
                thisLogger().error("gitpod: failed to check activity:", t)
            }
            delay(intervalInSeconds * 1000L)
        }
    }

    private suspend fun connectToServer(info: SupervisorInfoService.Result, launcher: GitpodServerLauncher) {
        val plugin = PluginManagerCore.getPlugin(PluginId.getId("io.gitpod.jetbrains.remote"))!!
        val connect = {
            val originalClassLoader = Thread.currentThread().contextClassLoader
            try {
                // see https://intellij-support.jetbrains.com/hc/en-us/community/posts/360003146180/comments/360000376240
                Thread.currentThread().contextClassLoader = HeartbeatService::class.java.classLoader
                launcher.listen(
                    info.infoResponse.gitpodApi.endpoint,
                    info.infoResponse.gitpodHost,
                    plugin.pluginId.idString,
                    plugin.version,
                    info.tokenResponse.token
                )
            } finally {
                Thread.currentThread().contextClassLoader = originalClassLoader;
            }
        }

        val minReconnectionDelay = 2 * 1000L
        val maxReconnectionDelay = 30 * 1000L
        val reconnectionDelayGrowFactor = 1.5;
        var reconnectionDelay = minReconnectionDelay;
        val gitpodHost = info.infoResponse.gitpodApi.host
        var closeReason: Any = "cancelled"
        try {
            while (coroutineContext.isActive) {
                try {
                    val connection = connect()
                    thisLogger().info("$gitpodHost: connected")
                    reconnectionDelay = minReconnectionDelay
                    closeReason = connection.await()
                    thisLogger().warn("$gitpodHost: connection closed, reconnecting after $reconnectionDelay milliseconds: $closeReason")
                } catch (t: Throwable) {
                    if (t is DeploymentException) {
                        // connection is alright, but server does not want to handshake, there is no point to try with the same token again
                        throw t
                    }
                    closeReason = t
                    thisLogger().warn(
                        "$gitpodHost: failed to connect, trying again after $reconnectionDelay milliseconds:",
                        closeReason
                    )
                }
                delay(reconnectionDelay)
                closeReason = "cancelled"
                reconnectionDelay = (reconnectionDelay * reconnectionDelayGrowFactor).toLong()
                if (reconnectionDelay > maxReconnectionDelay) {
                    reconnectionDelay = maxReconnectionDelay
                }
            }
        } catch (t: Throwable) {
            if (t !is CancellationException) {
                closeReason = t
            }
        }
        thisLogger().warn("$gitpodHost: connection permanently closed: $closeReason")
    }

    override fun dispose() = job.cancel()
}
