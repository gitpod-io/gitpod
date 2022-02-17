// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.services

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.project.ProjectManagerListener
import com.intellij.openapi.startup.StartupManager
import io.gitpod.supervisor.api.TerminalOuterClass.*
import io.gitpod.supervisor.api.TerminalServiceGrpc
import kotlinx.coroutines.guava.asDeferred
import org.jetbrains.plugins.terminal.TerminalView

@Service
class TerminalService {
    init {
        val connection = ApplicationManager.getApplication().messageBus.connect()
        connection.subscribe(ProjectManager.TOPIC, object : ProjectManagerListener {
            override fun projectOpened(project: Project) {
                thisLogger().warn("[Gitpod] TerminalService detected a new project: ${project.name}.")
                StartupManager.getInstance(project).runAfterOpened(Runnable {
                    ApplicationManager.getApplication().invokeLater(Runnable {
                        openTerminalView(project)
                    })
                })
            }
        })
    }

    private fun openTerminalView(project: Project) {
        try {
            val terminalView = TerminalView.getInstance(project)
            terminalView.createLocalShellWidget(project.basePath, "GP Terminal", true)
                .executeCommand("gp --help")
//            val state = TerminalTabState()
//            state.myTabName = "GP Terminal"
//            state.myWorkingDirectory = project.basePath
//            terminalView.createNewSession(terminalView.terminalRunner, state)
            thisLogger().warn("[Gitpod] TerminalService opened a terminal.")
        } catch (e: Exception) {
            thisLogger().error("[Gitpod] TerminalService failed to open terminal:", e)
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
