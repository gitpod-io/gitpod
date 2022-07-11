// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.runInEdt
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.util.application
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rdserver.terminal.BackendTerminalManager
import com.jetbrains.rdserver.unattendedHost.UnattendedHostManager
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalToolWindowFactory
import org.jetbrains.plugins.terminal.TerminalView
import java.util.concurrent.CompletableFuture

@Suppress("UnstableApiUsage", "EXPERIMENTAL_IS_NOT_ENABLED")
@OptIn(DelicateCoroutinesApi::class)
class GitpodTerminalService(private val project: Project) : Disposable {
    private val lifetime = Lifetime.Eternal.createNested()
    private val terminalView = TerminalView.getInstance(project)
    private val backendTerminalManager = BackendTerminalManager.getInstance(project)

    override fun dispose() {
        lifetime.terminate()
    }

    init {
        if (!application.isHeadlessEnvironment) {
            val job = launch()
            lifetime.onTerminationOrNow { job.cancel() }
        }
    }

    private fun launch() = GlobalScope.launch {
        getTerminalToolWindowRegisteredEvent().await()
        delayUntilControllerClientConnects()
        val widget = createNewSharedTerminal().await()
        printWelcomeMessage(widget)
    }

    private fun printWelcomeMessage(widget: ShellTerminalWidget) {
        widget.executeCommand(
                "clear; echo '\uD83D\uDC4B Welcome to Gitpod!\n" +
                        "\t\t - Start by typing `gp --help` to see what you can do with Gitpod CLI.\n" +
                        "\t\t - Run `gp tasks --help` to learn how to attach and watch tasks defined in .gitpod.yml!\n'; gp tasks attach"
        )
    }

    private fun getTerminalToolWindowRegisteredEvent(): CompletableFuture<Void> {
        val completableFuture = CompletableFuture<Void>()

        val messageBusConnection = project.messageBus.connect()

        val toolWindowManagerListener = object : ToolWindowManagerListener {
            override fun toolWindowsRegistered(ids: MutableList<String>, toolWindowManager: ToolWindowManager) {
                if (ids.contains(TerminalToolWindowFactory.TOOL_WINDOW_ID)) {
                    completableFuture.complete(null)
                    messageBusConnection.disconnect()
                }
            }
        }

        messageBusConnection.subscribe(ToolWindowManagerListener.TOPIC, toolWindowManagerListener)

        return completableFuture
    }

    private suspend fun delayUntilControllerClientConnects() {
        while (UnattendedHostManager.getInstance().controllerClientId == null) {
            delay(1000L)
        }
    }

    private fun createNewSharedTerminal(): CompletableFuture<ShellTerminalWidget> {
        val completableFuture = CompletableFuture<ShellTerminalWidget>()

        runInEdt {
            val shellTerminalWidget = terminalView.createLocalShellWidget(project.basePath, null)
            backendTerminalManager.shareTerminal(shellTerminalWidget, "Gitpod")
            completableFuture.complete(shellTerminalWidget)
        }

        return completableFuture
    }
}
