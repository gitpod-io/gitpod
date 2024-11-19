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

@Suppress("UnstableApiUsage")
abstract class AbstractGitpodPortForwardingService : GitpodPortForwardingService {
    companion object {
        const val FORWARDED_PORT_LABEL = "ForwardedByGitpod"
        const val EXPOSED_PORT_LABEL = "ExposedByGitpod"
    }

    private val perClientPortForwardingManager = service<PerClientPortForwardingManager>()
    private val ignoredPortsForNotificationService = service<GitpodIgnoredPortsForNotificationService>()
    private val lifetime = Lifetime.Eternal.createNested()

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
                application.invokeLater { syncPortsListWithClient(response) }
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

        servedPortsToStartForwarding.forEach { startForwarding(it) }

        exposedPortsToStartExposingOnClient.forEach { startExposingOnClient(it) }

        forwardedPortsToStopForwarding.forEach { stopForwarding(it) }

        exposedPortsToStopExposingOnClient.forEach { stopExposingOnClient(it) }

        portsList.forEach { updatePortsPresentation(it) }
    }

    private fun startForwarding(portStatus: PortsStatus) {
        if (isLocalPortForwardingDisabled()) {
            return
        }
        try {
            perClientPortForwardingManager.forwardPort(
                portStatus.localPort,
                PortType.TCP,
                setOf(FORWARDED_PORT_LABEL),
            )
        } catch (throwable: Throwable) {
            if (throwable !is PortAlreadyForwardedException) {
                thisLogger().warn("gitpod: Caught an exception while forwarding port: ${throwable.message}")
            }
        }
    }

    private fun stopForwarding(hostPort: Int) {
        perClientPortForwardingManager.getPorts(hostPort)
            .filter { it.labels.contains(FORWARDED_PORT_LABEL) }
            .forEach { perClientPortForwardingManager.removePort(it) }
    }

    private fun startExposingOnClient(portStatus: PortsStatus) {
        perClientPortForwardingManager.exposePort(
            portStatus.localPort,
            portStatus.exposed.url,
            setOf(EXPOSED_PORT_LABEL),
        )
    }

    private fun stopExposingOnClient(hostPort: Int) {
        perClientPortForwardingManager.getPorts(hostPort)
            .filter { it.labels.contains(EXPOSED_PORT_LABEL) }
            .forEach { perClientPortForwardingManager.removePort(it) }
    }

    private fun updatePortsPresentation(portStatus: PortsStatus) {
        perClientPortForwardingManager.getPorts(portStatus.localPort).forEach {
            if (it.configuration.isForwardedPort()) {
                it.presentation.name = portStatus.name
                it.presentation.description = portStatus.description
                it.presentation.tooltip = "Forwarded"
                it.presentation.icon = RowIcon(AllIcons.Actions.Commit)
            } else if (it.configuration.isExposedPort()) {
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

    override fun getLocalHostUriFromHostPort(hostPort: Int): Optional<URI> {
        val forwardedPort = perClientPortForwardingManager.getPorts(hostPort).firstOrNull {
            it.configuration.isForwardedPort()
        } ?: return Optional.empty()

        (forwardedPort.configuration as PortConfiguration.PerClientTcpForwarding).clientPortState.let {
            return if (it is ClientPortState.Assigned) {
                Optional.of(URIBuilder().setScheme("http").setHost(it.clientInterface).setPort(it.clientPort).build())
            } else {
                Optional.empty()
            }
        }
    }

    override fun dispose() {
        lifetime.terminate()
    }
}
