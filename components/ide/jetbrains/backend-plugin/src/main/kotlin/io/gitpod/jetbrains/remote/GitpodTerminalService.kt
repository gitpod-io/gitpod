// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.runInEdt
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.terminal.JBTerminalWidget
import com.intellij.util.application
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rdserver.terminal.BackendTerminalManager
import com.jetbrains.rdserver.unattendedHost.UnattendedHostManager
import io.gitpod.supervisor.api.Status.*
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.gitpod.supervisor.api.TerminalOuterClass
import io.gitpod.supervisor.api.TerminalServiceGrpc
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import kotlinx.coroutines.*
import kotlinx.coroutines.future.await
import kotlinx.coroutines.guava.asDeferred
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalToolWindowFactory
import org.jetbrains.plugins.terminal.TerminalView
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture

@Suppress("UnstableApiUsage", "EXPERIMENTAL_IS_NOT_ENABLED", "OPT_IN_IS_NOT_ENABLED")
@OptIn(DelicateCoroutinesApi::class)
class GitpodTerminalService(private val project: Project) : Disposable {
    private val lifetime = Lifetime.Eternal.createNested()
    private val terminalView = TerminalView.getInstance(project)
    private val terminalServiceFutureStub = TerminalServiceGrpc.newFutureStub(GitpodManager.supervisorChannel)
    private val statusServiceStub = StatusServiceGrpc.newStub(GitpodManager.supervisorChannel)
    private val backendTerminalManager = BackendTerminalManager.getInstance(project)

    override fun dispose() {
        lifetime.terminate()
    }

    init {
        if (!application.isHeadlessEnvironment) {
            launch()
        }
    }

    private fun launch() = GlobalScope.launch {
        getTerminalToolWindowRegisteredEvent().await()

        delayUntilControllerClientConnects()

        val tasks = getSupervisorTasksList().await()

        val terminals = getSupervisorTerminalsListAsync().await()

        connectTasksToTerminals(tasks, terminals)
    }

    private tailrec suspend fun delayUntilControllerClientConnects() {
        if (UnattendedHostManager.getInstance().controllerClientId == null) {
            delay(1000L)
            return delayUntilControllerClientConnects()
        }
    }

    private fun connectTasksToTerminals(
            tasks: List<TaskStatus>,
            terminals: List<TerminalOuterClass.Terminal>
    ) = runInEdt {
            if (tasks.isEmpty()) {
                backendTerminalManager.createNewSharedTerminal("Gitpod", "Terminal")
            } else {
                val aliasToTerminalMap: MutableMap<String, TerminalOuterClass.Terminal> = mutableMapOf()

                for (terminal in terminals) {
                    val terminalAlias = terminal.alias
                    aliasToTerminalMap[terminalAlias] = terminal
                }

                val registeredTerminals = terminalView.widgets.toMutableList()

                for (task in tasks) {
                    val terminalAlias = task.terminal
                    val terminal = aliasToTerminalMap[terminalAlias]

                    if (terminal != null) {
                        createSharedTerminal(terminal, registeredTerminals)
                    }
                }
            }
        }

    private fun getTerminalToolWindowRegisteredEvent(): CompletableFuture<Void> {
        debug("Waiting for TerminalToolWindow to be registered...")

        val completableFuture = CompletableFuture<Void>()

        val messageBusConnection = project.messageBus.connect()

        val toolWindowManagerListener = object : ToolWindowManagerListener {
            override fun toolWindowsRegistered(ids: MutableList<String>, toolWindowManager: ToolWindowManager) {
                if (ids.contains(TerminalToolWindowFactory.TOOL_WINDOW_ID)) {
                    debug("TerminalToolWindow got registered!")
                    completableFuture.complete(null)
                    messageBusConnection.disconnect()
                }
            }
        }

        messageBusConnection.subscribe(ToolWindowManagerListener.TOPIC, toolWindowManagerListener)

        return completableFuture
    }

    private suspend fun getSupervisorTasksList(): CompletableFuture<List<TaskStatus>> {
        val externalCompletableFuture = CompletableFuture<List<TaskStatus>>()

        GlobalScope.launch {
            val coroutineScope = this

            while(coroutineScope.isActive) {
                try {
                    val internalCompletableFuture = CompletableFuture<List<TaskStatus>>()

                    val taskStatusRequest = TasksStatusRequest.newBuilder().setObserve(true).build()

                    val taskStatusResponseObserver = object : ClientResponseObserver<TasksStatusRequest, TasksStatusResponse> {
                        override fun beforeStart(request: ClientCallStreamObserver<TasksStatusRequest>) {
                            lifetime.onTerminationOrNow {
                                request.cancel(null, null)
                            }
                        }

                        override fun onNext(response: TasksStatusResponse) {
                            for (task in response.tasksList) {
                                if (task.state === TaskState.opening) {
                                    return
                                }
                            }
                            internalCompletableFuture.complete(response.tasksList)
                        }

                        override fun onCompleted() { }

                        override fun onError(throwable: Throwable) {
                            internalCompletableFuture.completeExceptionally(throwable)
                        }
                    }

                    statusServiceStub.tasksStatus(taskStatusRequest, taskStatusResponseObserver)

                    val tasksList = internalCompletableFuture.await()

                    debug("Successfully got tasks from Supervisor:\n$tasksList")

                    coroutineScope.cancel()
                    externalCompletableFuture.complete(tasksList)
                } catch (throwable: Throwable) {
                    if (throwable is CancellationException) {
                        coroutineScope.cancel()
                        externalCompletableFuture.completeExceptionally(throwable)
                    } else {
                        thisLogger().error("Got an error while trying to get tasks from Supervisor.", throwable)
                    }
                }

                delay(1000L)
            }
        }

        return externalCompletableFuture
    }

    private fun getSupervisorTerminalsListAsync(): CompletableFuture<List<TerminalOuterClass.Terminal>> {
        val completableFuture = CompletableFuture<List<TerminalOuterClass.Terminal>>()

        GlobalScope.launch {
            val coroutineScope = this

            while(coroutineScope.isActive) {
                try {
                    val listTerminalsRequest = TerminalOuterClass.ListTerminalsRequest.newBuilder().build()

                    val deferredListTerminalsRequest = terminalServiceFutureStub.list(listTerminalsRequest).asDeferred()

                    lifetime.onTerminationOrNow {
                        deferredListTerminalsRequest.cancel()
                    }

                    val listTerminalsResponse = deferredListTerminalsRequest.await()

                    val terminalsList = listTerminalsResponse.terminalsList

                    debug("Successfully got the list of Supervisor terminals:\n${terminalsList}")

                    coroutineScope.cancel()
                    completableFuture.complete(terminalsList)
                } catch (throwable: Throwable) {
                    if (throwable is CancellationException) {
                        coroutineScope.cancel()
                        completableFuture.completeExceptionally(throwable)
                    } else {
                        thisLogger().error("Got an error while trying to get terminals list from Supervisor.", throwable)
                    }
                }

                delay(1000L)
            }
        }

        return completableFuture
    }

    private fun createSharedTerminal(supervisorTerminal: TerminalOuterClass.Terminal, registeredTerminals: MutableList<JBTerminalWidget>) {
        debug("Creating shared terminal '${supervisorTerminal.title}' on Backend IDE")

        backendTerminalManager.createNewSharedTerminal(supervisorTerminal.alias, supervisorTerminal.title)

        for (widget in terminalView.widgets) {
            if (!registeredTerminals.contains(widget)) {
                registeredTerminals.add(widget)
                (widget as ShellTerminalWidget).executeCommand("gp tasks attach ${supervisorTerminal.alias}")
            }
        }
    }

    private fun debug(message: String) = runInEdt {
        if (System.getenv("JB_DEV").toBoolean()) {
            thisLogger().warn(message)
        } else {
            thisLogger().info(message)
        }
    }
}
