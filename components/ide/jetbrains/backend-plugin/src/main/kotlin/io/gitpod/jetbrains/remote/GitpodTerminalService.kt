// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.util.application
import com.jediterm.terminal.ui.TerminalWidget
import com.jediterm.terminal.ui.TerminalWidgetListener
import com.jetbrains.rdserver.terminal.BackendTerminalManager
import io.gitpod.supervisor.api.Status
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.gitpod.supervisor.api.TerminalOuterClass
import io.gitpod.supervisor.api.TerminalServiceGrpc
import io.grpc.StatusRuntimeException
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalView
import java.util.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit

class GitpodTerminalService(project: Project) {
    private companion object {
        var hasStarted = false
    }

    private val terminalView = TerminalView.getInstance(project)
    private val backendTerminalManager = BackendTerminalManager.getInstance(project)
    private val terminalServiceFutureStub = TerminalServiceGrpc.newFutureStub(GitpodManager.supervisorChannel)
    private val terminalServiceStub = TerminalServiceGrpc.newStub(GitpodManager.supervisorChannel)
    private val statusServiceStub = StatusServiceGrpc.newStub(GitpodManager.supervisorChannel)

    init {
        start()
    }

    private fun start() {
        if (application.isHeadlessEnvironment || hasStarted) return

        hasStarted = true

        application.executeOnPooledThread {
            val terminals = getSupervisorTerminalsList()
            val tasks = getSupervisorTasksList()

            application.invokeLater {
                createTerminalsAttachedToTasks(terminals, tasks)
            }
        }
    }

    private fun createSharedTerminalAndExecuteCommand(title: String, command: String): ShellTerminalWidget? {
        val registeredTerminals = terminalView.widgets.toMutableList()

        backendTerminalManager.createNewSharedTerminal(UUID.randomUUID().toString(), title)

        for (widget in terminalView.widgets) {
            if (registeredTerminals.contains(widget)) continue

            widget.terminalTitle.change { applicationTitle = title }

            val shellTerminalWidget = widget as ShellTerminalWidget

            shellTerminalWidget.executeCommand(command)

            return shellTerminalWidget
        }

        return null
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
            val terminal = aliasToTerminalMap[terminalAlias] ?: continue

            createAttachedSharedTerminal(terminal)
        }
    }

    private tailrec fun getSupervisorTasksList(): List<Status.TaskStatus> {
        var tasksList: List<Status.TaskStatus>? = null

        try {
            val completableFuture = CompletableFuture<List<Status.TaskStatus>>()

            val taskStatusRequest = Status.TasksStatusRequest.newBuilder().setObserve(true).build()

            val taskStatusResponseObserver = object :
                    ClientResponseObserver<Status.TasksStatusRequest, Status.TasksStatusResponse> {
                override fun beforeStart(request: ClientCallStreamObserver<Status.TasksStatusRequest>) = Unit

                override fun onNext(response: Status.TasksStatusResponse) {
                    for (task in response.tasksList) {
                        if (task.state === Status.TaskState.opening) return
                    }

                    completableFuture.complete(response.tasksList)
                }

                override fun onCompleted() = Unit

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
                    "gitpod: Got an error while trying to get tasks list from Supervisor. " +
                            "Trying again in one second.",
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

            val listTerminalsResponse = listTerminalsResponseFuture.get()

            terminalsList = listTerminalsResponse.terminalsList
        } catch (throwable: Throwable) {
            if (throwable is InterruptedException) {
                throw throwable
            }

            thisLogger().error(
                    "gitpod: Got an error while trying to get terminals list from Supervisor. " +
                            "Trying again in one second.",
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
        val shellTerminalWidget = createSharedTerminalAndExecuteCommand(
                supervisorTerminal.title,
                "gp tasks attach ${supervisorTerminal.alias}"
        ) ?: return

        exitTaskWhenTerminalWidgetGetsClosed(supervisorTerminal, shellTerminalWidget)

        listenForTaskTerminationAndTitleChanges(supervisorTerminal, shellTerminalWidget)
    }

    private fun listenForTaskTerminationAndTitleChanges(
            supervisorTerminal: TerminalOuterClass.Terminal,
            shellTerminalWidget: ShellTerminalWidget
    ) = application.executeOnPooledThread {
        var hasOpenSessions = true

        while (hasOpenSessions) {
            val completableFuture = CompletableFuture<Void>()

            val listenTerminalRequest = TerminalOuterClass.ListenTerminalRequest.newBuilder()
                    .setAlias(supervisorTerminal.alias)
                    .build()

            val listenTerminalResponseObserver =
                    object : ClientResponseObserver<
                            TerminalOuterClass.ListenTerminalRequest,
                            TerminalOuterClass.ListenTerminalResponse
                            > {
                        override fun beforeStart(
                                request: ClientCallStreamObserver<TerminalOuterClass.ListenTerminalRequest>
                        ) {
                            @Suppress("ObjectLiteralToLambda")
                            shellTerminalWidget.addListener(object : TerminalWidgetListener {
                                override fun allSessionsClosed(widget: TerminalWidget) {
                                    hasOpenSessions = false
                                    request.cancel("gitpod: Terminal closed on the client.", null)
                                }
                            })
                        }

                        override fun onNext(response: TerminalOuterClass.ListenTerminalResponse) {
                            when {
                                response.hasTitle() -> application.invokeLater {
                                    shellTerminalWidget.terminalTitle.change {
                                        applicationTitle = response.title
                                    }
                                }

                                response.hasExitCode() -> application.invokeLater {
                                    shellTerminalWidget.close()
                                }
                            }
                        }

                        override fun onCompleted() = Unit

                        override fun onError(throwable: Throwable) {
                            completableFuture.completeExceptionally(throwable)
                        }
                    }

            terminalServiceStub.listen(listenTerminalRequest, listenTerminalResponseObserver)

            try {
                completableFuture.get()
            } catch (throwable: Throwable) {
                if (
                        throwable is StatusRuntimeException ||
                        throwable is ExecutionException ||
                        throwable is InterruptedException
                ) {
                    shellTerminalWidget.close()
                    thisLogger().info("gitpod: Stopped listening to " +
                            "'${supervisorTerminal.title}' terminal due to an expected exception.")
                    break
                }

                thisLogger()
                        .error("gitpod: Got an error while listening to " +
                                "'${supervisorTerminal.title}' terminal. Trying again in one second.", throwable)
            }

            TimeUnit.SECONDS.sleep(1)
        }
    }

    private fun exitTaskWhenTerminalWidgetGetsClosed(
            supervisorTerminal: TerminalOuterClass.Terminal,
            shellTerminalWidget: ShellTerminalWidget
    ) {
        @Suppress("ObjectLiteralToLambda")
        shellTerminalWidget.addListener(object : TerminalWidgetListener {
            override fun allSessionsClosed(widget: TerminalWidget) {
                terminalServiceFutureStub.shutdown(
                        TerminalOuterClass.ShutdownTerminalRequest.newBuilder()
                                .setAlias(supervisorTerminal.alias)
                                .build()
                )
            }
        })
    }
}
