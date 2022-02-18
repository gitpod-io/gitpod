// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.services

import com.intellij.codeWithMe.ClientId
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.runInEdt
import com.intellij.openapi.client.ClientSessionsManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.project.ProjectManagerListener
import io.gitpod.supervisor.api.TerminalOuterClass.*
import io.gitpod.supervisor.api.TerminalServiceGrpc
import kotlinx.coroutines.*
import kotlinx.coroutines.guava.asDeferred
import org.jetbrains.plugins.terminal.TerminalView

@OptIn(DelicateCoroutinesApi::class)
@Service
class TerminalService {
    init {
        val connection = ApplicationManager.getApplication().messageBus.connect()
        connection.subscribe(ProjectManager.TOPIC, object : ProjectManagerListener {
            override fun projectOpened(project: Project) {
                thisLogger().warn("[Gitpod] TerminalService detected a new project: ${project.name}.")
                GlobalScope.launch {
                    waitUntilGuestConnectsAsync(project, this).await()
                    runInEdt {
                        withClient(project) { p -> p?.let { openTerminalView(it) } }
                    }
                }
            }
        })
    }

    private suspend fun waitUntilGuestConnectsAsync(project: Project, parentScope: CoroutineScope) =
        parentScope.async {
            if (!isActive) {
                return@async false
            }

            thisLogger().warn("[Gitpod] TerminalService is waiting for the guest client to connect.")

            waitForClientSession(project, 1000L)

            true
        }

    @Suppress("UnstableApiUsage")
    tailrec suspend fun waitForClientSession(project: Project, checkPeriod: Long): Boolean {
        val session = ClientSessionsManager.getInstance(project).getSessions(false).firstOrNull()
        if (session != null) return true
        delay(checkPeriod)
        return waitForClientSession(project, checkPeriod)
    }

    private fun openTerminalView(project: Project) {
        try {
            val terminalView = TerminalView.getInstance(project)
            terminalView.createLocalShellWidget(project.basePath, "GP Terminal", true)
                .executeCommand("gp --help")
            thisLogger().warn("[Gitpod] TerminalService opened a terminal.")
        } catch (e: Exception) {
            thisLogger().error("[Gitpod] TerminalService failed to open terminal:", e)
        }

    }

    @Suppress("UnstableApiUsage")
    private fun withClient(project: Project, action: (project: Project?) -> Unit) {
        val session = ClientSessionsManager.getInstance(project).getSessions(false).firstOrNull()
        if (session != null) {
            ClientId.withClientId(session.clientId) {
                action(project)
            }
        } else {
            thisLogger().warn("[Gitpod] TerminalService failed to find the client session.")
        }
    }

    suspend fun registerTasks() {
        val terminalSize = TerminalSize.newBuilder().setCols(1).setRows(1).build()

        val listenTerminalRequest = ListenTerminalRequest.newBuilder()/*.setAlias("aliasFromSupervisor")*/.build()

        val writeTerminalResponse =
            TerminalServiceGrpc.newFutureStub(SupervisorInfoService.channel)
                .write(WriteTerminalRequest.newBuilder().build())
                .asDeferred()
                .await()

        val setTerminalSizeResponse =
            TerminalServiceGrpc.newFutureStub(SupervisorInfoService.channel)
                .setSize(SetTerminalSizeRequest.newBuilder().build())
                .asDeferred()
                .await()

        val shutdownTerminalResponse =
            TerminalServiceGrpc.newFutureStub(SupervisorInfoService.channel)
                .shutdown(ShutdownTerminalRequest.newBuilder().build())
                .asDeferred()
                .await()

        val listTerminalsResponse =
            TerminalServiceGrpc.newFutureStub(SupervisorInfoService.channel)
                .list(ListTerminalsRequest.newBuilder().build())
                .asDeferred()
                .await()
    }
}
