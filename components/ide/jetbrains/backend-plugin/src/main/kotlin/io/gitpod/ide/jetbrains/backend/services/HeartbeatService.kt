// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.ide.jetbrains.backend.services

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.logger
import io.gitpod.gitpodprotocol.api.ConnectionHelper
import io.gitpod.gitpodprotocol.api.GitpodServer
import io.gitpod.gitpodprotocol.api.entities.SendHeartBeatOptions
import io.gitpod.ide.jetbrains.backend.services.ControllerStatusProvider.Companion.ControllerStatus
import io.gitpod.ide.jetbrains.backend.utils.Retrier.retry
import kotlinx.coroutines.delay
import kotlinx.coroutines.future.await
import kotlinx.coroutines.runBlocking
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlin.random.Random.Default.nextInt
import java.lang.Thread

@Service
class HeartbeatService() : Disposable {
    private val logger = logger<HeartbeatService>()
    private val fetchToken: suspend () -> String = { AuthTokenService.fetchToken() }
    private val controllerStatusProvider = ControllerStatusProvider()

    @Suppress("MagicNumber")
    private val intervalInSeconds = 30

    private val uri = "wss://${System.getenv("GITPOD_HOST").split("//").last()}/api/v1"
    private val origin = System.getenv("GITPOD_WORKSPACE_URL")
    private val instanceId = System.getenv("GITPOD_INSTANCE_ID")

    private val server = AtomicReference<GitpodServer>()
    private val status = AtomicReference(
        ControllerStatus(
            connected = false,
            secondsSinceLastActivity = 0
        )
    )
    private val closed = AtomicBoolean(false)

    init {
        logger.info("Service initiated")

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
        val status = controllerStatusProvider.fetch()
        val previousStatus = this.status.getAndSet(status)

        if (status.connected != previousStatus.connected) {
            return sendHeartbeat(wasClosed = !status.connected)
        }

        if (status.connected && status.secondsSinceLastActivity <= maxIntervalInSeconds) {
            return sendHeartbeat(wasClosed = false)
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
            if (server.get() == null) {
                server.set(createServer())
            }

            @Suppress("TooGenericExceptionCaught") // Unsure what exceptions might be thrown
            try {
                val s = server.get()!!
                s.sendHeartBeat(SendHeartBeatOptions(instanceId, wasClosed)).await()
                logger.info("Heartbeat sent with wasClosed=$wasClosed")
            } catch (e: Exception) {
                // If connection fails for some reason,
                // remove the reference to the existing server.
                server.set(null)
                throw e
            }
        }
    }

    /**
     * @throws DeploymentException
     * @throws IOException
     * @throws IllegalStateException
     */
    private suspend fun createServer(): GitpodServer {
        logger.info("Creating GitpodServer")
        val token = fetchToken()
        val server = ConnectionHelper().connect(uri, origin, token).server()
        return server
    }

    override fun dispose() = closed.set(true)
}
