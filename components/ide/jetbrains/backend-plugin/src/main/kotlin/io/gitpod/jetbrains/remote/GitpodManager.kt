// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.remoteDev.util.onTerminationOrNow
import com.jetbrains.rd.util.lifetime.Lifetime
import git4idea.config.GitVcsApplicationSettings
import io.gitpod.jetbrains.remote.services.SupervisorInfoService
import io.gitpod.supervisor.api.Notification.NotifyRequest
import io.gitpod.supervisor.api.Notification.NotifyResponse
import io.gitpod.supervisor.api.Notification.RespondRequest
import io.gitpod.supervisor.api.Notification.SubscribeRequest
import io.gitpod.supervisor.api.Notification.SubscribeResponse
import io.gitpod.supervisor.api.NotificationServiceGrpc
import io.grpc.stub.ClientCallStreamObserver
import io.grpc.stub.ClientResponseObserver
import io.grpc.stub.StreamObserver
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import kotlinx.coroutines.*

@Service
class GitpodManager : Disposable {

    init {
        GitVcsApplicationSettings.getInstance().isUseCredentialHelper = true
    }

    private val lifetime = Lifetime.Eternal.createNested()

    private val notificationGroup = NotificationGroupManager.getInstance().getNotificationGroup("Gitpod Notifications")
    private val notificationsJob = GlobalScope.launch {
        val notifications = NotificationServiceGrpc.newStub(SupervisorInfoService.channel)
        val futureNotifications = NotificationServiceGrpc.newFutureStub(SupervisorInfoService.channel)
        while (isActive) {
            try {
                val f = CompletableFuture<Void>()
                notifications.subscribe(SubscribeRequest.newBuilder().build(), object : ClientResponseObserver<SubscribeRequest, SubscribeResponse> {

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
                                futureNotifications.respond(RespondRequest.newBuilder()
                                        .setRequestId(n.requestId)
                                        .setResponse(NotifyResponse.newBuilder().setAction(action).build())
                                        .build())
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

    override fun dispose() {
        lifetime.terminate()
    }
}