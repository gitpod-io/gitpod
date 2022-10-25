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
import com.intellij.ui.RowIcon
import com.intellij.util.application
import com.jetbrains.rd.platform.codeWithMe.portForwarding.*
import com.jetbrains.rd.platform.util.lifetime
import com.jetbrains.rd.util.lifetime.LifetimeStatus
import io.gitpod.jetbrains.remote.GitpodIgnoredPortsForNotificationService
import io.gitpod.jetbrains.remote.GitpodManager
import io.gitpod.jetbrains.remote.GitpodGlobalPortForwardingService
import io.gitpod.jetbrains.remote.GitpodPortsService
import io.gitpod.jetbrains.remote.icons.GitpodIcons
import io.gitpod.supervisor.api.Status
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import io.ktor.utils.io.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import javax.swing.Icon

@Suppress("UnstableApiUsage")
class GitpodGlobalPortForwardingServiceImpl: GitpodGlobalPortForwardingService {
    private val globalPortForwardingManager = service<GlobalPortForwardingManager>()

    override fun monitorPortsOfPid(disposable: Disposable, pid: Long) {
        globalPortForwardingManager.monitorPortsOfPid(
                disposable,
                pid,
                object : ListeningPortHandler {
                    override fun onPortListeningStarted(port: ListeningPort) {
                        thisLogger().warn("gitpod: onPortListeningStarted ${port.portType} ${port.pid} ${port.socketAddress}")
                    }
                },
                PortListeningOptions.INCLUDE_SELF_AND_CHILDREN
        )
    }
}
