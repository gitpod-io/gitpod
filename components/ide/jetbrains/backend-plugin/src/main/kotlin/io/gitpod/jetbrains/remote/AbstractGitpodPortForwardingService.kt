// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.icons.AllIcons
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.ui.RowIcon
import com.intellij.util.application
import com.jetbrains.rd.platform.codeWithMe.portForwarding.*
import com.jetbrains.rd.util.URI
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.lifetime.LifetimeDefinition
import io.gitpod.supervisor.api.Status
import io.gitpod.supervisor.api.Status.PortsStatus
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import kotlinx.coroutines.*
import kotlinx.coroutines.future.asDeferred
import org.apache.http.client.utils.URIBuilder
import java.util.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

@Suppress("UnstableApiUsage")
abstract class AbstractGitpodPortForwardingService : GitpodPortForwardingService {
    companion object {
        const val FORWARDED_PORT_LABEL = "ForwardedByGitpod"
        const val EXPOSED_PORT_LABEL = "ExposedByGitpod"
        private const val MAX_CONCURRENT_OPERATIONS = 10
        private const val BATCH_SIZE = 10
        private const val BATCH_DELAY = 100L
        private const val DEBOUNCE_DELAY = 500L
    }

    private val perClientPortForwardingManager = service<PerClientPortForwardingManager>()
    private val ignoredPortsForNotificationService = service<GitpodIgnoredPortsForNotificationService>()
    private val lifetime = Lifetime.Eternal.createNested()

    // Store current observed ports and their lifetime references
    private val portLifetimes = ConcurrentHashMap<Int, LifetimeDefinition>()

    // Debounce job for port updates
    private var debounceJob: Job? = null

    // Semaphore to limit concurrent operations
    private val operationSemaphore = Semaphore(MAX_CONCURRENT_OPERATIONS)

    init { start() }

    private fun start() {
        if (application.isHeadlessEnvironment) return

        if (isLocalPortForwardingDisabled()) {
            thisLogger().warn("gitpod: Local port forwarding is disabled.")
        }

        observePortsListWhileProjectIsOpen()
    }

    protected abstract fun runJob(lifetime: Lifetime, block: suspend CoroutineScope.() -> Unit): Job;

    private fun observePortsListWhileProjectIsOpen() = runJob(lifetime) {
        while (isActive) {
            try {
                observePortsList().asDeferred().await()
            } catch (throwable: Throwable) {
                when (throwable) {
                    is InterruptedException, is CancellationException -> {
                        cancel("gitpod: Stopped observing ports list due to an expected interruption.")
                    }
                    else -> {
                        thisLogger().warn(
                            "gitpod: Got an error while trying to get ports list from Supervisor. " +
                                    "Going to try again in a second.",
                            throwable
                        )
                        delay(1000)
                    }
                }
            }
        }
    }

    private fun observePortsList(): CompletableFuture<Void> {
        val completableFuture = CompletableFuture<Void>()

        val statusServiceStub = StatusServiceGrpc.newStub(GitpodManager.supervisorChannel)

        val portsStatusRequest = Status.PortsStatusRequest.newBuilder().setObserve(true).build()

        val portsStatusResponseObserver = object :
            ClientResponseObserver<Status.PortsStatusRequest, Status.PortsStatusResponse> {
            override fun beforeStart(request: ClientCallStreamObserver<Status.PortsStatusRequest>) {
                lifetime.onTerminationOrNow { request.cancel("gitpod: Service lifetime terminated.", null) }
            }

            override fun onNext(response: Status.PortsStatusResponse) {
                debounceJob?.cancel()
                debounceJob = runJob(lifetime) {
                    delay(DEBOUNCE_DELAY)
                    try {
                        syncPortsListWithClient(response)
                    } catch (e: Exception) {
                        thisLogger().error("gitpod: Error during port observation", e)
                    } finally {
                        debounceJob = null
                    }
                }
            }

            override fun onCompleted() {
                completableFuture.complete(null)
            }

            override fun onError(throwable: Throwable) {
                completableFuture.completeExceptionally(throwable)
            }
        }

        statusServiceStub.portsStatus(portsStatusRequest, portsStatusResponseObserver)

        return completableFuture
    }

    private fun isLocalPortForwardingDisabled(): Boolean {
        return System.getenv("GITPOD_DISABLE_JETBRAINS_LOCAL_PORT_FORWARDING")?.toBoolean() ?: false
    }

    private fun syncPortsListWithClient(response: Status.PortsStatusResponse) {
        val ignoredPorts = ignoredPortsForNotificationService.getIgnoredPorts()
        val portsList = response.portsList.filter { !ignoredPorts.contains(it.localPort) }
        val portsNumbersFromPortsList = portsList.map { it.localPort }
        val servedPorts = portsList.filter { it.served }
        val exposedPorts = servedPorts.filter { it.exposed?.url?.isNotBlank() ?: false }
        val portsNumbersFromNonServedPorts = portsList.filter { !it.served }.map { it.localPort }

        val allPortsToKeep = mutableSetOf<Int>()

        val servedPortsToStartForwarding = servedPorts.filter {
            perClientPortForwardingManager.getPorts(it.localPort).none { p -> p.labels.contains(FORWARDED_PORT_LABEL) }
        }
        val exposedPortsToStartExposingOnClient = exposedPorts.filter {
            perClientPortForwardingManager.getPorts(it.localPort).none { p -> p.labels.contains(EXPOSED_PORT_LABEL) }
        }
        val forwardedPortsToStopForwarding = perClientPortForwardingManager.getPorts(FORWARDED_PORT_LABEL)
            .map { it.hostPortNumber }
            .filter { portsNumbersFromNonServedPorts.contains(it) || !portsNumbersFromPortsList.contains(it) }
        val exposedPortsToStopExposingOnClient = perClientPortForwardingManager.getPorts(EXPOSED_PORT_LABEL)
            .map { it.hostPortNumber }
            .filter { portsNumbersFromNonServedPorts.contains(it) || !portsNumbersFromPortsList.contains(it) }

        runJob(lifetime) {
            coroutineScope {
                // Stop operations first to free up resources
                launch {
                    processPortsInBatches(forwardedPortsToStopForwarding) { port ->
                        operationSemaphore.withPermit { stopForwarding(port) }
                    }
                }
                launch {
                    processPortsInBatches(exposedPortsToStopExposingOnClient) { port ->
                        operationSemaphore.withPermit { stopExposingOnClient(port) }
                    }
                }

                // Wait for stop operations to complete
                awaitAll()

                // Start new operations
                launch {
                    processPortsInBatches(servedPortsToStartForwarding) { port ->
                        operationSemaphore.withPermit {
                            startForwarding(port)
                            allPortsToKeep.add(port.localPort)
                        }
                    }
                }
                launch {
                    processPortsInBatches(exposedPortsToStartExposingOnClient) { port ->
                        operationSemaphore.withPermit {
                            startExposingOnClient(port)
                            allPortsToKeep.add(port.localPort)
                        }
                    }
                }

                // Update presentation in parallel with start operations
                launch {
                    processPortsInBatches(portsList) { port ->
                        application.invokeLater {
                            updatePortsPresentation(port)
                            allPortsToKeep.add(port.localPort)
                        }
                    }
                }

                // Wait for all operations to complete
                awaitAll()

                // Clean up after all operations are done
                cleanupUnusedLifetimes(allPortsToKeep)
            }
        }
    }

    private suspend fun <T> processPortsInBatches(ports: List<T>, action: suspend (T) -> Unit) {
        ports.chunked(BATCH_SIZE).forEach { batch ->
            try {
                batch.forEach { port ->
                    try {
                        withTimeout(5000) {
                            action(port)
                        }
                    } catch (e: Exception) {
                        thisLogger().warn("gitpod: Error processing port in batch", e)
                    }
                }
                delay(BATCH_DELAY)
            } catch (e: Exception) {
                thisLogger().error("gitpod: Error processing batch", e)
                delay(BATCH_DELAY * 2)
            }
        }
    }

    private fun cleanupUnusedLifetimes(portsToKeep: Set<Int>) {
        portLifetimes.keys.filter { !portsToKeep.contains(it) }.forEach { port ->
            portLifetimes[port]?.let { lifetime ->
                thisLogger().debug("gitpod: Terminating lifetime for port $port")
                lifetime.terminate()
                portLifetimes.remove(port)
            }
        }
    }

    private fun startForwarding(portStatus: PortsStatus) {
        if (isLocalPortForwardingDisabled()) return

        val portLifetime = getOrCreatePortLifetime(portStatus.localPort)

        try {
            thisLogger().debug("gitpod: Starting forwarding for port ${portStatus.localPort}")
            val port = perClientPortForwardingManager.forwardPort(
                portStatus.localPort,
                PortType.TCP,
                setOf(FORWARDED_PORT_LABEL),
            )

            portLifetime.onTerminationOrNow {
                thisLogger().debug("gitpod: Cleaning up port ${portStatus.localPort} due to lifetime termination")
                try {
                    perClientPortForwardingManager.removePort(port)
                } catch (e: Exception) {
                    thisLogger().warn("gitpod: Failed to remove port on lifetime termination", e)
                }
            }
        } catch (throwable: Throwable) {
            if (throwable !is PortAlreadyForwardedException) {
                thisLogger().warn("gitpod: Caught an exception while forwarding port: ${throwable.message}")
            }
        }
    }

    private fun stopForwarding(hostPort: Int) {
        thisLogger().debug("gitpod: Stopping forwarding for port $hostPort")
        val portsToRemove = perClientPortForwardingManager.getPorts(hostPort)
            .filter { it.labels.contains(FORWARDED_PORT_LABEL) }

        terminatePortLifetime(hostPort)

        portsToRemove.forEach {
            try {
                perClientPortForwardingManager.removePort(it)
            } catch (e: Exception) {
                thisLogger().warn("gitpod: Failed to remove forwarded port $hostPort", e)
            }
        }
    }

    private fun startExposingOnClient(portStatus: PortsStatus) {
        val portLifetime = getOrCreatePortLifetime(portStatus.localPort)

        thisLogger().debug("gitpod: Starting exposing for port ${portStatus.localPort}")
        val port = perClientPortForwardingManager.exposePort(
            portStatus.localPort,
            portStatus.exposed.url,
            setOf(EXPOSED_PORT_LABEL),
        )

        portLifetime.onTerminationOrNow {
            thisLogger().debug("gitpod: Cleaning up exposed port ${portStatus.localPort} due to lifetime termination")
            try {
                perClientPortForwardingManager.removePort(port)
            } catch (e: Exception) {
                thisLogger().warn("gitpod: Failed to remove exposed port on lifetime termination", e)
            }
        }
    }

    private fun stopExposingOnClient(hostPort: Int) {
        thisLogger().debug("gitpod: Stopping exposing for port $hostPort")
        val portsToRemove = perClientPortForwardingManager.getPorts(hostPort)
            .filter { it.labels.contains(EXPOSED_PORT_LABEL) }

        terminatePortLifetime(hostPort)

        portsToRemove.forEach {
            try {
                perClientPortForwardingManager.removePort(it)
            } catch (e: Exception) {
                thisLogger().warn("gitpod: Failed to remove exposed port $hostPort", e)
            }
        }
    }

    private fun getOrCreatePortLifetime(port: Int): Lifetime =
        portLifetimes.computeIfAbsent(port) {
            thisLogger().debug("gitpod: Creating new lifetime for port $port")
            lifetime.createNested()
        }

    private fun terminatePortLifetime(port: Int) {
        portLifetimes[port]?.let { portLifetime ->
            thisLogger().debug("gitpod: Terminating lifetime for port $port")
            portLifetime.terminate()
            portLifetimes.remove(port)
        }
    }

    private fun updatePortsPresentation(portStatus: PortsStatus) {
        perClientPortForwardingManager.getPorts(portStatus.localPort).forEach {
            when {
                it.configuration.isForwardedPort() -> {
                    it.presentation.name = portStatus.name
                    it.presentation.description = portStatus.description
                    it.presentation.tooltip = "Forwarded"
                    it.presentation.icon = RowIcon(AllIcons.Actions.Commit)
                }
                it.configuration.isExposedPort() -> {
                    val isPubliclyExposed = (portStatus.exposed.visibility == Status.PortVisibility.public_visibility)
                    it.presentation.name = portStatus.name
                    it.presentation.description = portStatus.description
                    it.presentation.tooltip = "Exposed (${if (isPubliclyExposed) "Public" else "Private"})"
                    it.presentation.icon = if (isPubliclyExposed) {
                        RowIcon(AllIcons.Actions.Commit)
                    } else {
                        RowIcon(AllIcons.Actions.Commit, AllIcons.Diff.Lock)
                    }
                }
            }
        }
    }

    override fun getLocalHostUriFromHostPort(hostPort: Int): Optional<URI> =
        perClientPortForwardingManager.getPorts(hostPort)
            .firstOrNull { it.configuration.isForwardedPort() }
            ?.let { forwardedPort ->
                (forwardedPort.configuration as PortConfiguration.PerClientTcpForwarding)
                    .clientPortState
                    .let {
                        if (it is ClientPortState.Assigned) {
                            Optional.of(URIBuilder().setScheme("http").setHost(it.clientInterface).setPort(it.clientPort).build())
                        } else {
                            Optional.empty()
                        }
                    }
            } ?: Optional.empty()

    override fun dispose() {
        portLifetimes.values.forEach { it.terminate() }
        portLifetimes.clear()
        lifetime.terminate()
    }
}
