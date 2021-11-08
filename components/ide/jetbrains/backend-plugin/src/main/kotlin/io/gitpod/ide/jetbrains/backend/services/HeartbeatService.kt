// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.ide.jetbrains.backend.services

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.logger
import io.gitpod.gitpodprotocol.api.ConnectionHelper
import io.gitpod.gitpodprotocol.api.entities.SendHeartBeatOptions
import io.gitpod.ide.jetbrains.backend.services.ControllerStatusService.ControllerStatus
import io.gitpod.ide.jetbrains.backend.utils.Retrier.retry
import kotlinx.coroutines.delay
import kotlinx.coroutines.future.await
import kotlinx.coroutines.runBlocking
import java.io.IOException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlin.random.Random.Default.nextInt

@Service
class HeartbeatService : Disposable {
    private val logger = logger<HeartbeatService>()

    @Suppress("MagicNumber")
    private val intervalInSeconds = 30

    private val heartbeatClient = AtomicReference<HeartbeatClient>()
    private val status = AtomicReference(
        ControllerStatus(
            connected = false,
            secondsSinceLastActivity = 0
        )
    )
    private val closed = AtomicBoolean(false)

    init {
        logger.info("Service initiating")

        @Suppress("MagicNumber")
        thread(name = "gitpod-heartbeat", contextClassLoader = this.javaClass.classLoader) {
            runBlocking {
                while (!closed.get()) {
                    checkActivity(intervalInSeconds + nextInt(5, 15))
                    delay(intervalInSeconds * 1000L)
                }
            }
        }
    }

    private suspend fun checkActivity(maxIntervalInSeconds: Int) {
        logger.info("Checking activity")
        val status = try {
            ControllerStatusService.fetch()
        } catch (e: IOException) {
            logger.error(e.message, e)
            return@checkActivity
        }
        val previousStatus = this.status.getAndSet(status)

        val wasClosed: Boolean? = when {
            status.connected != previousStatus.connected -> !status.connected
            status.connected && status.secondsSinceLastActivity <= maxIntervalInSeconds -> false
            else -> null
        }

        if (wasClosed != null) {
            @Suppress("TooGenericExceptionCaught")
            return try {
                sendHeartbeat(wasClosed)
            } catch (e: Exception) {
                logger.error("Failed to send heartbeat with wasClosed=$wasClosed", e)
            }
        }
    }

    /**
     * @throws DeploymentException
     * @throws IOException
     * @throw IllegalStateException
     */
    @Synchronized
    private suspend fun sendHeartbeat(wasClosed: Boolean = false) {
        retry(2, logger) {
            if (heartbeatClient.get() == null) {
                heartbeatClient.set(createHeartbeatClient())
            }

            @Suppress("TooGenericExceptionCaught") // Unsure what exceptions might be thrown
            try {
                heartbeatClient.get()!!(wasClosed).await()
                logger.info("Heartbeat sent with wasClosed=$wasClosed")
            } catch (e: Exception) {
                // If connection fails for some reason,
                // remove the reference to the existing server.
                heartbeatClient.set(null)
                throw e
            }
        }
    }

    /**
     * @throws DeploymentException
     * @throws IOException
     * @throws IllegalStateException
     */
    private suspend fun createHeartbeatClient(): HeartbeatClient {
        logger.info("Creating HeartbeatClient")
        val supervisorInfo = SupervisorInfoService.fetch()

        val server = ConnectionHelper().connect(
            "wss://${supervisorInfo.host.split("//").last()}/api/v1",
            supervisorInfo.workspaceUrl,
            supervisorInfo.authToken
        ).server()

        return { wasClosed: Boolean ->
            server.sendHeartBeat(SendHeartBeatOptions(supervisorInfo.instanceId, wasClosed))
        }
    }

    override fun dispose() = closed.set(true)
}

typealias HeartbeatClient = (Boolean) -> CompletableFuture<Void>
