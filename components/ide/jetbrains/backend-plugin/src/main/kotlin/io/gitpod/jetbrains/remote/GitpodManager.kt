// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.extensions.PluginId
import com.intellij.remoteDev.util.onTerminationOrNow
import com.jetbrains.rd.util.lifetime.Lifetime
import git4idea.config.GitVcsApplicationSettings
import io.gitpod.gitpodprotocol.api.GitpodClient
import io.gitpod.gitpodprotocol.api.GitpodServerLauncher
import io.gitpod.jetbrains.remote.services.HeartbeatService
import io.gitpod.supervisor.api.*
import io.gitpod.supervisor.api.Info.WorkspaceInfoResponse
import io.gitpod.supervisor.api.Notification.*
import io.grpc.ManagedChannel
import io.grpc.ManagedChannelBuilder
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.future.await
import kotlinx.coroutines.guava.asDeferred
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.jetbrains.ide.BuiltInServerManager
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import javax.websocket.DeploymentException
import io.gitpod.jetbrains.remote.utils.Retrier.retry

@Service
class GitpodManager : Disposable {

    companion object {
        // there should be only one channel per an application to avoid memory leak
        val supervisorChannel: ManagedChannel = ManagedChannelBuilder.forTarget("localhost:22999").usePlaintext().build()
    }

    val devMode = System.getenv("JB_DEV").toBoolean()

    private val lifetime = Lifetime.Eternal.createNested()

    override fun dispose() {
        lifetime.terminate()
    }

    init {
        GlobalScope.launch {
            try {
                val backendPort = BuiltInServerManager.getInstance().waitForStart().port
                val httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.ALWAYS)
                    .connectTimeout(Duration.ofSeconds(5))
                    .build()
                val httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:24000/gatewayLink?backendPort=${backendPort}"))
                    .GET()
                    .build()
                val response =
                    httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
                if (response.statusCode() == 200) {
                    val gatewayLink = response.body()
                    thisLogger().warn(
                        "\n\n\n*********************************************************\n\n" +
                                "Gitpod gateway link: $gatewayLink" +
                                "\n\n*********************************************************\n\n\n"
                    )
                } else {
                    throw Exception("" + response.statusCode())
                }
            } catch (t: Throwable) {
                thisLogger().error("gitpod: failed to resolve gateway link:", t)
            }
        }
    }

    init {
        GitVcsApplicationSettings.getInstance().isUseCredentialHelper = true
    }

    private val notificationGroup = NotificationGroupManager.getInstance().getNotificationGroup("Gitpod Notifications")
    private val notificationsJob = GlobalScope.launch {
        val notifications = NotificationServiceGrpc.newStub(supervisorChannel)
        val futureNotifications = NotificationServiceGrpc.newFutureStub(supervisorChannel)
        while (isActive) {
            try {
                val f = CompletableFuture<Void>()
                notifications.subscribe(
                    SubscribeRequest.newBuilder().build(),
                    object : ClientResponseObserver<SubscribeRequest, SubscribeResponse> {

                        override fun beforeStart(requestStream: ClientCallStreamObserver<SubscribeRequest>) {
                            // TODO(ak): actually should be bound to cancellation of notifications job
                            lifetime.onTerminationOrNow {
                                requestStream.cancel(null, null)
                            }
                        }

                        override fun onNext(n: SubscribeResponse) {
                            val request = n.request
                            val type = when (request.level) {
                                NotifyRequest.Level.ERROR -> NotificationType.ERROR
                                NotifyRequest.Level.WARNING -> NotificationType.WARNING
                                else -> NotificationType.INFORMATION
                            }
                            val notification = notificationGroup.createNotification(request.message, type)
                            for (action in request.actionsList) {
                                notification.addAction(NotificationAction.createSimpleExpiring(action) {
                                    futureNotifications.respond(
                                        RespondRequest.newBuilder()
                                            .setRequestId(n.requestId)
                                            .setResponse(NotifyResponse.newBuilder().setAction(action).build())
                                            .build()
                                    )
                                })
                            }
                            notification.notify(null)
                        }

                        override fun onError(t: Throwable) {
                            f.completeExceptionally(t)
                        }

                        override fun onCompleted() {
                            f.complete(null)
                        }
                    })
                f.await()
            } catch (t: Throwable) {
                if (t is CancellationException) {
                    throw t
                }
                thisLogger().error("gitpod: failed to stream notifications: ", t)
            }
            delay(1000L)
        }
    }
    init {
        lifetime.onTerminationOrNow {
            notificationsJob.cancel()
        }
    }

    val pendingInfo = CompletableFuture<WorkspaceInfoResponse>()
    private val infoJob = GlobalScope.launch {
        try {
            // TODO(ak) replace retry with proper handling of grpc errors
            val infoResponse = retry(3) {
                InfoServiceGrpc
                        .newFutureStub(supervisorChannel)
                        .workspaceInfo(Info.WorkspaceInfoRequest.newBuilder().build())
                        .asDeferred()
                        .await()
            }
            pendingInfo.complete(infoResponse)
        } catch (t: Throwable) {
            pendingInfo.completeExceptionally(t)
        }
    }
    init {
        lifetime.onTerminationOrNow {
            infoJob.cancel()
        }
    }

    val client = GitpodClient()
    private val serverJob = GlobalScope.launch {
        val info = pendingInfo.await()

        // TODO(ak) replace retry with proper handling of grpc errors
        val tokenResponse = retry(3) {
            val request = Token.GetTokenRequest.newBuilder()
                    .setHost(info.gitpodApi.host)
                    .addScope("function:sendHeartBeat")
                    .addScope("function:trackEvent")
                    .setKind("gitpod")
                    .build()

            TokenServiceGrpc
                    .newFutureStub(supervisorChannel)
                    .getToken(request)
                    .asDeferred()
                    .await()
        }

        val launcher = GitpodServerLauncher.create(client)
        val plugin = PluginManagerCore.getPlugin(PluginId.getId("io.gitpod.jetbrains.remote"))!!
        val connect = {
            val originalClassLoader = Thread.currentThread().contextClassLoader
            try {
                // see https://intellij-support.jetbrains.com/hc/en-us/community/posts/360003146180/comments/360000376240
                Thread.currentThread().contextClassLoader = HeartbeatService::class.java.classLoader
                launcher.listen(
                        info.gitpodApi.endpoint,
                        info.gitpodHost,
                        plugin.pluginId.idString,
                        plugin.version,
                        tokenResponse.token
                )
            } finally {
                Thread.currentThread().contextClassLoader = originalClassLoader;
            }
        }

        val minReconnectionDelay = 2 * 1000L
        val maxReconnectionDelay = 30 * 1000L
        val reconnectionDelayGrowFactor = 1.5;
        var reconnectionDelay = minReconnectionDelay;
        val gitpodHost = info.gitpodApi.host
        var closeReason: Any = "cancelled"
        try {
            while (kotlin.coroutines.coroutineContext.isActive) {
                try {
                    val connection = connect()
                    thisLogger().info("$gitpodHost: connected")
                    reconnectionDelay = minReconnectionDelay
                    closeReason = connection.await()
                    thisLogger().warn("$gitpodHost: connection closed, reconnecting after $reconnectionDelay milliseconds: $closeReason")
                } catch (t: Throwable) {
                    if (t is DeploymentException) {
                        // connection is alright, but server does not want to handshake, there is no point to try with the same token again
                        throw t
                    }
                    closeReason = t
                    thisLogger().warn(
                            "$gitpodHost: failed to connect, trying again after $reconnectionDelay milliseconds:",
                            closeReason
                    )
                }
                delay(reconnectionDelay)
                closeReason = "cancelled"
                reconnectionDelay = (reconnectionDelay * reconnectionDelayGrowFactor).toLong()
                if (reconnectionDelay > maxReconnectionDelay) {
                    reconnectionDelay = maxReconnectionDelay
                }
            }
        } catch (t: Throwable) {
            if (t !is CancellationException) {
                closeReason = t
            }
        }
        thisLogger().warn("$gitpodHost: connection permanently closed: $closeReason")
    }
    init {
        lifetime.onTerminationOrNow {
            serverJob.cancel()
        }
    }
}