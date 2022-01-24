// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.ide.BrowserUtil
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.remote.RemoteCredentialsHolder
import com.intellij.ui.dsl.builder.panel
import com.intellij.ui.dsl.gridLayout.HorizontalAlign
import com.intellij.ui.dsl.gridLayout.VerticalAlign
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import com.jetbrains.gateway.api.ConnectionRequestor
import com.jetbrains.gateway.api.GatewayConnectionHandle
import com.jetbrains.gateway.api.GatewayConnectionProvider
import com.jetbrains.gateway.ssh.ClientOverSshTunnelConnector
import com.jetbrains.gateway.thinClientLink.ThinClientHandle
import com.jetbrains.rd.util.URI
import com.jetbrains.rd.util.lifetime.Lifetime
import io.gitpod.gitpodprotocol.api.entities.WorkspaceInstance
import io.gitpod.jetbrains.icons.GitpodIcons
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import java.net.URL
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import javax.swing.JComponent
import javax.swing.JLabel

class GitpodConnectionProvider : GatewayConnectionProvider {

    private val gitpod = service<GitpodConnectionService>()

    override suspend fun connect(
        parameters: Map<String, String>,
        requestor: ConnectionRequestor
    ): GatewayConnectionHandle? {
        if (parameters["gitpodHost"] == null) {
            throw IllegalArgumentException("bad gitpodHost parameter");
        }
        if (parameters["workspaceId"] == null) {
            throw IllegalArgumentException("bad workspaceId parameter");
        }
        val connectParams = ConnectParams(
            parameters["gitpodHost"]!!,
            parameters["workspaceId"]!!
        )
        val client = gitpod.obtainClient(connectParams.gitpodHost)
        val connectionLifetime = Lifetime.Eternal.createNested()
        val updates = client.listenToWorkspace(connectionLifetime, connectParams.workspaceId)
        val workspace = client.syncWorkspace(connectParams.workspaceId).workspace

        val phaseMessage = JLabel()
        val statusMessage = JLabel()
        val errorMessage = JLabel()
        var ideUrl = "";
        val connectionPanel = panel {
            row {
                resizableRow()
                panel {
                    resizableColumn()
                    verticalAlign(VerticalAlign.CENTER)
                    row {
                        icon(GitpodIcons.Logo2x)
                            .horizontalAlign(HorizontalAlign.CENTER)
                    }
                    row {
                        cell(phaseMessage)
                            .bold()
                            .horizontalAlign(HorizontalAlign.CENTER)
                    }
                    row {
                        cell(statusMessage)
                            .horizontalAlign(HorizontalAlign.CENTER)
                            .applyToComponent {
                                foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                            }
                    }
                    panel {
                        row {
                            link(connectParams.workspaceId) {
                                if (ideUrl.isNotBlank()) {
                                    BrowserUtil.browse(ideUrl)
                                }
                            }
                        }
                        row {
                            browserLink(workspace.context.normalizedContextURL, workspace.context.normalizedContextURL)
                        }
                    }.horizontalAlign(HorizontalAlign.CENTER)
                    row {
                        cell(errorMessage)
                            .horizontalAlign(HorizontalAlign.CENTER)
                            .applyToComponent {
                                foreground = UIUtil.getErrorForeground()
                            }
                    }
                }
            }
        }

        GlobalScope.launch {
            var thinClient: ThinClientHandle? = null;
            var thinClientJob: Job? = null;

            val httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .build()

            var lastUpdate: WorkspaceInstance? = null;
            try {
                for (update in updates) {
                    try {
                        if (WorkspaceInstance.isUpToDate(lastUpdate, update)) {
                            continue;
                        }
                        ideUrl = update.ideUrl
                        lastUpdate = update;
                        if (!update.status.conditions.failed.isNullOrBlank()) {
                            errorMessage.text = update.status.conditions.failed;
                        }
                        when (update.status.phase) {
                            "preparing" -> {
                                phaseMessage.text = "Preparing"
                                statusMessage.text = "Building workspace image..."
                            }
                            "pending" -> {
                                phaseMessage.text = "Preparing"
                                statusMessage.text = "Allocating resources …"
                            }
                            "creating" -> {
                                phaseMessage.text = "Creating"
                                statusMessage.text = "Pulling workspace image …"
                            }
                            "initializing" -> {
                                phaseMessage.text = "Starting"
                                statusMessage.text = "Initializing workspace content …"
                            }
                            "running" -> {
                                phaseMessage.text = "Running"
                                statusMessage.text = "Connecting..."
                            }
                            "interrupted" -> {
                                phaseMessage.text = "Starting"
                                statusMessage.text = "Checking workspace …"
                            }
                            "stopping" -> {
                                phaseMessage.text = "Stopping"
                                statusMessage.text = ""
                            }
                            "stopped" -> {
                                if (update.status.conditions.timeout.isNullOrBlank()) {
                                    phaseMessage.text = "Stopped"
                                } else {
                                    phaseMessage.text = "Timed Out"
                                }
                                statusMessage.text = ""
                            }
                            else -> {
                                phaseMessage.text = ""
                                statusMessage.text = ""
                            }
                        }

                        if (update.status.phase == "stopping" || update.status.phase == "stopped") {
                            thinClientJob?.cancel()
                            thinClient?.close()
                        }

                        if (thinClientJob == null && update.status.phase == "running") {
                            thinClientJob = launch {
                                val ownerToken = client.server.getOwnerToken(update.workspaceId).await()

                                val ideUrl = URL(update.ideUrl);
                                var joinLink: String? = null
                                val maxRequestTimeout = 30 * 1000L
                                val timeoutDelayGrowFactor = 1.5;
                                var requestTimeout = 2 * 1000L
                                while (joinLink == null) {
                                    try {
                                        val httpRequest = HttpRequest.newBuilder()
                                            .uri(URI.create("https://24000-${ideUrl.host}/joinLink"))
                                            .header("x-gitpod-owner-token", ownerToken)
                                            .GET()
                                            .timeout(Duration.ofMillis(requestTimeout))
                                            .build()
                                        val response =
                                            httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
                                        if (response.statusCode() == 200) {
                                            joinLink = response.body()
                                            errorMessage.text = ""
                                        } else {
                                            errorMessage.text =
                                                "failed to fetch join link: ${response.statusCode()}, trying again...";
                                        }
                                    } catch (t: Throwable) {
                                        if (t is CancellationException) {
                                            throw t
                                        }
                                        thisLogger().error(
                                            "${connectParams.gitpodHost}: ${connectParams.workspaceId}: failed to fetch join link:",
                                            t
                                        )
                                        errorMessage.text = "failed to fetch join link: ${t.message}, trying again...";
                                    }
                                    requestTimeout = (requestTimeout * timeoutDelayGrowFactor).toLong()
                                    if (requestTimeout > maxRequestTimeout) {
                                        requestTimeout = maxRequestTimeout
                                    }
                                }

                                val credentials = RemoteCredentialsHolder()
                                credentials.setHost(ideUrl.host)
                                credentials.port = 22
                                credentials.userName = update.workspaceId
                                credentials.password = ownerToken

                                val connector = ClientOverSshTunnelConnector(
                                    connectionLifetime,
                                    credentials,
                                    URI(joinLink)
                                )
                                val client = connector.connect()
                                client.clientClosed.advise(connectionLifetime) {
                                    connectionLifetime.terminate()
                                }
                                client.onClientPresenceChanged.advise(connectionLifetime) {
                                    if (client.clientPresent) {
                                        statusMessage.text = ""
                                    }
                                }
                                thinClient = client
                            }
                        }
                    } catch (e: Throwable) {
                        thisLogger().error(
                            "${connectParams.gitpodHost}: ${connectParams.workspaceId}: failed to process workspace update:",
                            e
                        )
                    }
                }
                connectionLifetime.terminate()
            } catch (t: Throwable) {
                thisLogger().error(
                    "${connectParams.gitpodHost}: ${connectParams.workspaceId}: failed to process workspace updates:",
                    t
                )
                errorMessage.text = " failed to process workspace updates ${t.message}"
            }
        }

        return GitpodConnectionHandle(connectionLifetime, connectionPanel, connectParams);
    }

    override fun isApplicable(parameters: Map<String, String>): Boolean =
        parameters.containsKey("gitpodHost")

    private data class ConnectParams(
        val gitpodHost: String,
        val workspaceId: String
    )

    private class GitpodConnectionHandle(
        lifetime: Lifetime,
        private val component: JComponent,
        private val params: ConnectParams
    ) : GatewayConnectionHandle(lifetime) {

        override fun createComponent(): JComponent {
            return component
        }

        override fun getTitle(): String {
            return "${params.workspaceId} (${params.gitpodHost})"
        }

        override fun hideToTrayOnStart(): Boolean {
            return false
        }
    }

}
