// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.latest

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.remoteDev.util.onTerminationOrNow
//import com.intellij.ui.RowIcon
import com.intellij.util.application
import com.jetbrains.rd.platform.codeWithMe.portForwarding.*
import com.jetbrains.rd.platform.util.lifetime
import com.jetbrains.rd.util.lifetime.LifetimeStatus
import io.gitpod.jetbrains.remote.GitpodIgnoredPortsForNotificationService
import io.gitpod.jetbrains.remote.GitpodManager
import io.gitpod.jetbrains.remote.GitpodPortsService
//import io.gitpod.jetbrains.remote.icons.GitpodIcons
import io.gitpod.supervisor.api.Status
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import io.ktor.utils.io.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import javax.swing.Icon

@Suppress("UnstableApiUsage")
class GitpodPortForwardingService(private val project: Project) {
    companion object {
        const val FORWARDED_PORT_LABEL = "gitpod"
    }

    private val portsService = service<GitpodPortsService>()
    private val perClientPortForwardingManager = service<PerClientPortForwardingManager>()
    private val ignoredPortsForNotificationService = service<GitpodIgnoredPortsForNotificationService>()
    private val portToDisposableMap = mutableMapOf<Int,Disposable>()

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
        val ignoredPorts = ignoredPortsForNotificationService.getIgnoredPorts()

        for (port in response.portsList) {
            if (ignoredPorts.contains(port.localPort)) continue

            val hostPort = port.localPort
            val isServed = port.served
            val isForwarded = perClientPortForwardingManager.getPorts(hostPort).isNotEmpty()

            if (isServed && !isForwarded) {
                try {
                    val forwardedPort = perClientPortForwardingManager.forwardPort(
                        hostPort,
                        PortType.TCP,
                        setOf(FORWARDED_PORT_LABEL),
                        ClientPortAttributes(hostPort, ClientPortPickingStrategy.REASSIGN_WHEN_BUSY),
                    )

                    forwardedPort.presentation.name = port.name
                    forwardedPort.presentation.description = port.description
//                    forwardedPort.presentation.tooltip = "Forwarded Port"
//                    val rowIcon = RowIcon(2)
//                    rowIcon.setIcon(GitpodIcons.Logo, 0)
//                    rowIcon.setIcon(GitpodIcons.Logo, 1)
//                    forwardedPort.presentation.icon = rowIcon

                    val portListenerDisposable = portToDisposableMap.getOrPut(hostPort, fun() = Disposer.newDisposable())

                    forwardedPort.addPortListener(portListenerDisposable, object: ForwardedPortListener {
//                        override fun becameReadOnly(port: ForwardedPort, reason: String?) {
//                            thisLogger().warn("gitpod: becameReadOnly($port, $reason)")
//                        }
//
//                        override fun descriptionChanged(port: ForwardedPort, oldDescription: String?, newDescription: String?) {
//                            thisLogger().warn("gitpod: descriptionChanged($port, $oldDescription, $newDescription)")
//                        }
//
//                        override fun exposedUrlChanged(port: ForwardedPort, newUrl: String) {
//                            thisLogger().warn("gitpod: exposedUrlChanged($port, $newUrl)")
//                        }
//
//                        override fun iconChanged(port: ForwardedPort, oldIcon: Icon?, newIcon: Icon?) {
//                            thisLogger().warn("gitpod: iconChanged($port, $oldIcon, $newIcon)")
//                        }
//
//                        override fun nameChanged(port: ForwardedPort, oldName: String?, newName: String?) {
//                            thisLogger().warn("gitpod: nameChanged($port, $oldName, $newName)")
//                        }
//
//                        override fun tooltipChanged(port: ForwardedPort, oldTooltip: String?, newTooltip: String?) {
//                            thisLogger().warn("gitpod: tooltipChanged($port, $oldTooltip, $newTooltip)")
//                        }

                        override fun stateChanged(port: ForwardedPort, newState: ClientPortState) {
                            when (newState) {
                                is ClientPortState.Assigned -> {
                                    thisLogger().info("gitpod: Started forwarding host port $hostPort to client port ${newState.clientPort}.")
                                    portsService.setForwardedPort(hostPort, newState.clientPort)
                                }
                                is ClientPortState.FailedToAssign -> {
                                    thisLogger().warn("gitpod: Detected that host port $hostPort failed to be assigned to a client port.")
                                }
                                else -> {
                                    thisLogger().warn("gitpod: Detected that host port $hostPort is not assigned to any client port.")
                                }
                            }
                        }
                    })
                } catch (error: Error) {
                    thisLogger().warn("gitpod: ${error.message}")
                }
            }

            if (!isServed && isForwarded) {
                val portListenerDisposable = portToDisposableMap[hostPort]
                if (portListenerDisposable != null) {
                    portListenerDisposable.dispose()
                    portToDisposableMap.remove(hostPort)
                }
                perClientPortForwardingManager.getPorts(hostPort).forEach { portToRemove ->
                    perClientPortForwardingManager.removePort(portToRemove)
                }
                portsService.removeForwardedPort(hostPort)
                thisLogger().info("gitpod: Stopped forwarding port $hostPort.")
            }

//            if (!isServed && !isForwarded) {
//                val exposedPort = perClientPortForwardingManager.exposePort(
//                        hostPort,
//                        port.exposed.url,
//                        setOf(FORWARDED_PORT_LABEL),
//                )
//
//                exposedPort.presentation.name = port.name
//                exposedPort.presentation.description = port.description
//                exposedPort.presentation.icon = GitpodIcons.Logo
//                exposedPort.presentation.tooltip = "Exposed Port"
//            }
//
//            perClientPortForwardingManager.getPorts(hostPort).forEach {
//                it.presentation.name = port.name
//                it.presentation.description = port.description
//                thisLogger().warn("gitpod: changing name and description of port $hostPort")
//            }
        }
    }
}
