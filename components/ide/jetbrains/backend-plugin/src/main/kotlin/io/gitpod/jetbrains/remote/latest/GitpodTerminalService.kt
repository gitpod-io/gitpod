// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.latest

import com.intellij.openapi.Disposable
import com.intellij.openapi.client.ClientProjectSession
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.util.application
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rdserver.terminal.BackendTerminalManager
import io.gitpod.jetbrains.remote.GitpodManager
import io.gitpod.supervisor.api.Status
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.gitpod.supervisor.api.TerminalOuterClass
import io.gitpod.supervisor.api.TerminalServiceGrpc
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalView
import java.util.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@Suppress("UnstableApiUsage")
class GitpodTerminalService(session: ClientProjectSession) : Disposable {
    private companion object {
        /** Indicates if this service is already running, because we shouldn't run it more than once. */
        var isRunning = false
    }

    private val lifetime = Lifetime.Eternal.createNested()
    private val terminalView = TerminalView.getInstance(session.project)
    private val backendTerminalManager = BackendTerminalManager.getInstance(session.project)
    private val terminalServiceFutureStub = TerminalServiceGrpc.newFutureStub(GitpodManager.supervisorChannel)
    private val statusServiceStub = StatusServiceGrpc.newStub(GitpodManager.supervisorChannel)

    override fun dispose() {
        lifetime.terminate()
    }

    init {
        run()
    }

    private fun run() {
        if (application.isHeadlessEnvironment || isRunning) return

        isRunning = true

        val task = application.executeOnPooledThread {
            val terminals = getSupervisorTerminalsList()
            val tasks = getSupervisorTasksList()

            application.invokeLater {
                createTerminalsAttachedToTasks(terminals, tasks)
            }
        }

        lifetime.onTerminationOrNow {
            task.cancel(true)
        }
    }

    private fun createSharedTerminalAndExecuteCommand(title: String, command: String) {
        val registeredTerminals = terminalView.widgets.toMutableList()

        backendTerminalManager.createNewSharedTerminal(UUID.randomUUID().toString(), title)

        for (widget in terminalView.widgets) {
            if (!registeredTerminals.contains(widget)) {
                widget.terminalTitle.change {
                    applicationTitle = title
                }
                (widget as ShellTerminalWidget).executeCommand(command)
            }
        }
    }

    private fun createTerminalsAttachedToTasks(
        terminals: List<TerminalOuterClass.Terminal>,
        tasks: List<Status.TaskStatus>
    ) {
        if (tasks.isEmpty()) return

        val aliasToTerminalMap: MutableMap<String, TerminalOuterClass.Terminal> = mutableMapOf()

        for (terminal in terminals) {
            val terminalAlias = terminal.alias
            aliasToTerminalMap[terminalAlias] = terminal
        }

        for (task in tasks) {
            val terminalAlias = task.terminal
            val terminal = aliasToTerminalMap[terminalAlias]

            if (terminal != null) {
                createAttachedSharedTerminal(terminal)
            }
        }
    }

    private tailrec fun getSupervisorTasksList(): List<Status.TaskStatus> {
        var tasksList: List<Status.TaskStatus>? = null

        try {
            val completableFuture = CompletableFuture<List<Status.TaskStatus>>()

            val taskStatusRequest = Status.TasksStatusRequest.newBuilder().setObserve(true).build()

            val taskStatusResponseObserver = object :
                ClientResponseObserver<Status.TasksStatusRequest, Status.TasksStatusResponse> {
                override fun beforeStart(request: ClientCallStreamObserver<Status.TasksStatusRequest>) {
                    lifetime.onTerminationOrNow {
                        request.cancel(null, null)
                    }
                }

                override fun onNext(response: Status.TasksStatusResponse) {
                    for (task in response.tasksList) {
                        if (task.state === Status.TaskState.opening) {
                            return
                        }
                    }
                    completableFuture.complete(response.tasksList)
                }

                override fun onCompleted() {}

                override fun onError(throwable: Throwable) {
                    completableFuture.completeExceptionally(throwable)
                }
            }

            statusServiceStub.tasksStatus(taskStatusRequest, taskStatusResponseObserver)

            tasksList = completableFuture.get()
        } catch (throwable: Throwable) {
            if (throwable is InterruptedException) {
                throw throwable
            }

            thisLogger().error(
                "Got an error while trying to get tasks list from Supervisor. Trying again in on second.",
                throwable
            )
        }

        return if (tasksList != null) {
            tasksList
        } else {
            TimeUnit.SECONDS.sleep(1)
            getSupervisorTasksList()
        }
    }

    private tailrec fun getSupervisorTerminalsList(): List<TerminalOuterClass.Terminal> {
        var terminalsList: List<TerminalOuterClass.Terminal>? = null

        try {
            val listTerminalsRequest = TerminalOuterClass.ListTerminalsRequest.newBuilder().build()

            val listTerminalsResponseFuture = terminalServiceFutureStub.list(listTerminalsRequest)

            lifetime.onTerminationOrNow {
                listTerminalsResponseFuture.cancel(true)
            }

            val listTerminalsResponse = listTerminalsResponseFuture.get()

            terminalsList = listTerminalsResponse.terminalsList
        } catch (throwable: Throwable) {
            if (throwable is InterruptedException) {
                throw throwable
            }

            thisLogger().error(
                "Got an error while trying to get terminals list from Supervisor. Trying again in on second.",
                throwable
            )
        }

        return if (terminalsList != null) {
            terminalsList
        } else {
            TimeUnit.SECONDS.sleep(1)
            getSupervisorTerminalsList()
        }
    }

    private fun createAttachedSharedTerminal(supervisorTerminal: TerminalOuterClass.Terminal) {
        createSharedTerminalAndExecuteCommand(
            supervisorTerminal.title,
            "gp tasks attach ${supervisorTerminal.alias}"
        )
    }
}
