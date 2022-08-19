// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.latest

import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.util.application
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PortType
import com.jetbrains.rd.platform.util.lifetime
import com.jetbrains.rd.util.lifetime.LifetimeStatus
import com.jetbrains.rdserver.portForwarding.*
import com.jetbrains.rdserver.portForwarding.remoteDev.ControllerPortsInformationProvider
import io.gitpod.jetbrains.remote.GitpodManager
import io.gitpod.jetbrains.remote.GitpodPortsService
import io.gitpod.supervisor.api.Status
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import io.ktor.utils.io.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@Suppress("UnstableApiUsage")
class GitpodPortForwardingService(private val project: Project) {
    companion object {
        const val FORWARDED_PORT_LABEL = "gitpod"
    }

    private val portsService = service<GitpodPortsService>()
    private val controllerPortsInformationProvider = service<ControllerPortsInformationProvider>()

    init { start() }

    private fun start() {
        if (application.isHeadlessEnvironment) return

        observePortsListWhileProjectIsOpen()
    }

    private fun observePortsListWhileProjectIsOpen() = application.executeOnPooledThread {
        while (project.lifetime.status == LifetimeStatus.Alive) {
            try {
                observePortsList().get()
            } catch (throwable: Throwable) {
                when (throwable) {
                    is InterruptedException, is CancellationException -> break
                    else -> thisLogger().error(
                            "gitpod: Got an error while trying to get ports list from Supervisor. " +
                                    "Going to try again in a second.",
                            throwable
                    )
                }
            }

            TimeUnit.SECONDS.sleep(1)
        }
    }

    private fun observePortsList(): CompletableFuture<Void> {
        val completableFuture = CompletableFuture<Void>()

        val statusServiceStub = StatusServiceGrpc.newStub(GitpodManager.supervisorChannel)

        val portsStatusRequest = Status.PortsStatusRequest.newBuilder().setObserve(true).build()

        val portsStatusResponseObserver = object :
                ClientResponseObserver<Status.PortsStatusRequest, Status.PortsStatusResponse> {
            override fun beforeStart(request: ClientCallStreamObserver<Status.PortsStatusRequest>) {
                project.lifetime.onTerminationOrNow { request.cancel("gitpod: Project terminated.", null) }
            }
            override fun onNext(response: Status.PortsStatusResponse) {
                application.invokeLater { updateForwardedPortsList(response) }
            }
            override fun onCompleted() { completableFuture.complete(null) }
            override fun onError(throwable: Throwable) { completableFuture.completeExceptionally(throwable) }
        }

        statusServiceStub.portsStatus(portsStatusRequest, portsStatusResponseObserver)

        return completableFuture
    }

    private fun updateForwardedPortsList(response: Status.PortsStatusResponse) {
        val portForwardingManager = PortForwardingManager.getInstance()
        val forwardedPorts = portForwardingManager.getPortsWithLabel(FORWARDED_PORT_LABEL)

        for (port in response.portsList) {
            val hostPort = port.localPort
            val isServed = port.served
            val existingForwardedPort = forwardedPorts.find { it.hostPortNumber == hostPort }

            if (isServed && existingForwardedPort == null) {
                portForwardingManager.addPort(Port.ExposedPort(
                        hostPort,
                        PortIdentity.MutableNameAndDescription(port.name, port.description),
                        setOf(FORWARDED_PORT_LABEL),
                        Property(port.exposed.url),
                        Property(PortVisibility.PrivatePort())
                ))

                portForwardingManager.addPort(Port.ForwardedPort(
                        hostPort,
                        PortType.HTTP,
                        PortIdentity.MutableNameAndDescription(port.name, port.description),
                        setOf(FORWARDED_PORT_LABEL)
                ))

                // Note: The code below won't work because the addittion of a port takes some time in background, so it's
                // to early to try caching them at this moment.
                when (val clientPortState = controllerPortsInformationProvider.getForwardedClientPortState(hostPort)) {
                    is ClientPortState.Assigned -> {
                        thisLogger().warn("gitpod: Started forwarding host port $hostPort to client port ${clientPortState.clientPort}.")
                        portsService.setForwardedPort(hostPort, clientPortState.clientPort)
                    }
                    is ClientPortState.FailedToAssign -> {
                        thisLogger().warn("gitpod: Detected that host port $hostPort failed to be assigned to a client port.")
                    }
                    else -> {
                        thisLogger().warn("gitpod: Detected that host port $hostPort is not assigned to any client port.")
                    }
                }
            }

            if (!isServed && existingForwardedPort != null) {
                thisLogger().warn("hostPort $hostPort stopped being")
                portForwardingManager.removePort(existingForwardedPort)
                portsService.removeForwardedPort(hostPort)
                thisLogger().warn("gitpod: Stopped forwarding port $hostPort.")
            }
        }
    }
}
