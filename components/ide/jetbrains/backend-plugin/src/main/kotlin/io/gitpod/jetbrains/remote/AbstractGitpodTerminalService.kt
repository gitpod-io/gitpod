// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.rd.defineNestedLifetime
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.util.application
import com.jediterm.terminal.ui.TerminalWidget
import com.jediterm.terminal.ui.TerminalWidgetListener
import com.jetbrains.rd.util.lifetime.Lifetime
import io.gitpod.supervisor.api.Status
import io.gitpod.supervisor.api.StatusServiceGrpc
import io.gitpod.supervisor.api.TerminalOuterClass
import io.gitpod.supervisor.api.TerminalServiceGrpc
import io.grpc.StatusRuntimeException
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import kotlinx.coroutines.*
import kotlinx.coroutines.future.await
import kotlinx.coroutines.guava.await
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutionException
import kotlin.coroutines.coroutineContext

abstract class AbstractGitpodTerminalService(project: Project) : Disposable {
    private val lifetime = defineNestedLifetime()
    private val terminalServiceFutureStub = TerminalServiceGrpc.newFutureStub(GitpodManager.supervisorChannel)
    private val terminalServiceStub = TerminalServiceGrpc.newStub(GitpodManager.supervisorChannel)
    private val statusServiceStub = StatusServiceGrpc.newStub(GitpodManager.supervisorChannel)

    init {
        start()
    }

    protected abstract fun runJob(lifetime: Lifetime, block: suspend CoroutineScope.() -> Unit): Job

    override fun dispose() = Unit
    protected fun start() {
        if (application.isHeadlessEnvironment) return

        runJob(lifetime) {
            try {
                val terminals = withTimeout(20000L) { getSupervisorTerminalsList() }
                val tasks = withTimeout(20000L) { getSupervisorTasksList() }
                thisLogger().info("gitpod: attaching tasks ${tasks.size}, terminals ${terminals.size}")
                if (tasks.isEmpty() && terminals.isEmpty()) {
                    return@runJob
                }
                // see internal chat https://gitpod.slack.com/archives/C02BRJLGPGF/p1716540080028119
                delay(5000L)
                application.invokeLater {
                    createTerminalsAttachedToTasks(terminals, tasks)
                }
            } catch (e: TimeoutCancellationException) {
                thisLogger().error("gitpod: timeout while fetching tasks or terminals", e)
            } catch (e: Exception) {
                thisLogger().error("gitpod: error while attaching tasks", e)
            }
        }
    }

    protected abstract fun createSharedTerminal(id: String, title: String): ShellTerminalWidget

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

        tasks.forEachIndexed { index, task ->
            val terminalAlias = task.terminal
            val terminal = aliasToTerminalMap[terminalAlias]

            if (terminal == null) {
                thisLogger().warn("gitpod: found no terminal for task ${task.id}, expecting ${task.terminal}")
                return
            }
            val title = terminal.title.takeIf { !it.isNullOrBlank() } ?: "Gitpod Task ${index + 1}"
            thisLogger().info("gitpod: attaching task ${terminal.title} (${task.terminal}) with title $title")
            createAttachedSharedTerminal(title, terminal)
            thisLogger().info("gitpod: attached task ${terminal.title} (${task.terminal})")
        }
    }

    private tailrec suspend fun getSupervisorTasksList(): List<Status.TaskStatus> {
        var tasksList: List<Status.TaskStatus>? = null
        coroutineContext.ensureActive()
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

            tasksList = completableFuture.await()
        } catch (throwable: Throwable) {
            if (throwable is InterruptedException) {
                throw throwable
            }

            thisLogger().error(
                "gitpod: Got an error while trying to get tasks list from Supervisor. Trying again in one second.",
                throwable
            )
        }

        return tasksList ?: run {
            delay(1000)
            getSupervisorTasksList()
        }
    }

    private tailrec suspend fun getSupervisorTerminalsList(): List<TerminalOuterClass.Terminal> {
        var terminalsList: List<TerminalOuterClass.Terminal>? = null
        coroutineContext.ensureActive()
        try {
            val listTerminalsRequest = TerminalOuterClass.ListTerminalsRequest.newBuilder().build()

            val listTerminalsResponseFuture = terminalServiceFutureStub.list(listTerminalsRequest)

            val listTerminalsResponse = listTerminalsResponseFuture.await()

            terminalsList = listTerminalsResponse.terminalsList
        } catch (throwable: Throwable) {
            if (throwable is InterruptedException) {
                throw throwable
            }

            thisLogger().error(
                "gitpod: Got an error while trying to get terminals list from Supervisor. Trying again in one second.",
                throwable
            )
        }

        return terminalsList ?: run {
            delay(1000)
            getSupervisorTerminalsList()
        }
    }

    private fun createAttachedSharedTerminal(title: String, supervisorTerminal: TerminalOuterClass.Terminal) {
        val shellTerminalWidget = createSharedTerminal(supervisorTerminal.alias, title)
        shellTerminalWidget.executeCommand("gp tasks attach ${supervisorTerminal.alias}")
        closeTerminalWidgetWhenClientGetsClosed(supervisorTerminal, shellTerminalWidget)
        exitTaskWhenTerminalWidgetGetsClosed(supervisorTerminal, shellTerminalWidget)
        listenForTaskTerminationAndTitleChanges(supervisorTerminal, shellTerminalWidget)
    }

    private fun listenForTaskTerminationAndTitleChanges(
        supervisorTerminal: TerminalOuterClass.Terminal,
        shellTerminalWidget: ShellTerminalWidget
    ) = runJob(lifetime) {
        var hasOpenSessions = true

        while (hasOpenSessions) {
            val completableFuture = CompletableFuture<Void>()

            val listenTerminalRequest = TerminalOuterClass.ListenTerminalRequest.newBuilder()
                .setAlias(supervisorTerminal.alias)
                .build()

            val listenTerminalResponseObserver =
                object :
                    ClientResponseObserver<TerminalOuterClass.ListenTerminalRequest, TerminalOuterClass.ListenTerminalResponse> {
                    override fun beforeStart(request: ClientCallStreamObserver<TerminalOuterClass.ListenTerminalRequest>) {
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
                completableFuture.await()
            } catch (throwable: Throwable) {
                if (
                    throwable is StatusRuntimeException ||
                    throwable is ExecutionException ||
                    throwable is InterruptedException
                ) {
                    shellTerminalWidget.close()
                    break
                }

                thisLogger().error(
                    "gitpod: got an error while listening to '${supervisorTerminal.title}' terminal. Trying again in one second.",
                    throwable
                )
            }

            delay(1000)
        }
    }

    private fun exitTaskWhenTerminalWidgetGetsClosed(
        supervisorTerminal: TerminalOuterClass.Terminal,
        shellTerminalWidget: ShellTerminalWidget
    ) {
        shellTerminalWidget.addListener(object : TerminalWidgetListener {
            override fun allSessionsClosed(widget: TerminalWidget) {
                runJob(lifetime) {
                    delay(5000)
                    try {
                        thisLogger().info("gitpod: shutdown task ${supervisorTerminal.title} (${supervisorTerminal.alias})")
                        terminalServiceFutureStub.shutdown(
                            TerminalOuterClass.ShutdownTerminalRequest.newBuilder()
                                .setAlias(supervisorTerminal.alias)
                                .build()
                        ).await()
                    } catch (throwable: Throwable) {
                        thisLogger().error(
                            "gitpod: got an error while shutting down '${supervisorTerminal.title}' terminal.",
                            throwable
                        )
                    }
                }
            }
        })
    }

    private fun closeTerminalWidgetWhenClientGetsClosed(
        supervisorTerminal: TerminalOuterClass.Terminal,
        shellTerminalWidget: ShellTerminalWidget
    ) {
        @Suppress("UnstableApiUsage")
        lifetime.onTerminationOrNow {
            thisLogger().debug("gitpod: closing task terminal service ${supervisorTerminal.title} (${supervisorTerminal.alias})")
            shellTerminalWidget.close()
        }
    }
}
