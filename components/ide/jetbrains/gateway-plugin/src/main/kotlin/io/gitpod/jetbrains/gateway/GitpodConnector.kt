// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.icons.AllIcons
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.CompositeDisposable
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.wm.impl.welcomeScreen.WelcomeScreenUIManager
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.dsl.builder.BottomGap
import com.intellij.ui.dsl.builder.RightGap
import com.intellij.ui.dsl.builder.TopGap
import com.intellij.ui.dsl.builder.panel
import com.intellij.ui.dsl.gridLayout.HorizontalAlign
import com.intellij.ui.dsl.gridLayout.VerticalAlign
import com.intellij.ui.layout.ComponentPredicate
import com.intellij.ui.layout.not
import com.intellij.util.EventDispatcher
import com.intellij.util.ui.JBFont
import com.jetbrains.gateway.api.GatewayConnector
import com.jetbrains.gateway.api.GatewayConnectorView
import com.jetbrains.gateway.api.GatewayRecentConnections
import com.jetbrains.gateway.api.GatewayUI.Companion.getInstance
import com.jetbrains.rd.util.concurrentMapOf
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.lifetime.LifetimeDefinition
import com.jetbrains.rd.util.lifetime.isAlive
import com.jetbrains.rd.util.lifetime.isNotAlive
import io.gitpod.gitpodprotocol.api.entities.GetWorkspacesOptions
import io.gitpod.gitpodprotocol.api.entities.IDEOption
import io.gitpod.gitpodprotocol.api.entities.WorkspaceInstance
import io.gitpod.jetbrains.auth.GitpodAuthService
import io.gitpod.jetbrains.icons.GitpodIcons
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.actor
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import java.awt.Component
import java.util.*
import javax.swing.DefaultComboBoxModel
import javax.swing.Icon
import javax.swing.JComponent
import javax.swing.text.SimpleAttributeSet
import javax.swing.text.StyleConstants
import javax.swing.text.StyledDocument


class GitpodConnector : GatewayConnector {
    override val icon: Icon
        get() = GitpodIcons.Logo

    override fun createView(lifetime: Lifetime): GatewayConnectorView {
        return GitpodConnectorView(lifetime)
    }

    override fun getActionText(): String {
        return "Connect to Gitpod"
    }

    override fun getDescription(): String? {
        return "Connect to Gitpod workspaces"
    }

    override fun getDocumentationLink(): String {
        // TODO(ak) something JetBrains specific
        return "https://www.gitpod.io/docs"
    }

    override fun getDocumentationLinkText(): String {
        return super.getDocumentationLinkText()
    }

    override fun getRecentConnections(setContentCallback: (Component) -> Unit): GatewayRecentConnections? {
        return GitpodRecentConnections(setContentCallback)
    }

    override fun getTitle(): String {
        return "Gitpod"
    }

    override fun getTitleAdornment(): JComponent? {
        return null
    }

    override fun initProcedure() {}

    interface Listener : EventListener {
        fun stateChanged()
    }

    class GitpodConnectorView(
        lifetime: Lifetime
    ) : GatewayConnectorView {
        private val settings = service<GitpodSettingsState>()

        private val backendsModel = DefaultComboBoxModel<String>()
        private val backendToId = concurrentMapOf<String, String>()
        private val backendsLoadedDispatcher = EventDispatcher.create(Listener::class.java)
        private val backendsLoaded = object : ComponentPredicate() {

            override fun addListener(listener: (Boolean) -> Unit) {
                backendsLoadedDispatcher.addListener(object : Listener {
                    override fun stateChanged() {
                        listener(invoke())
                    }
                })
            }

            override fun invoke(): Boolean {
                return backendsModel.size > 0
            }
        }

        override val component = panel {
            indent {
                row {
                    icon(GitpodIcons.Logo).gap(RightGap.SMALL)
                    label("Gitpod").applyToComponent {
                        this.font = JBFont.h3().asBold()
                    }
                }.topGap(TopGap.MEDIUM).bottomGap(BottomGap.SMALL)
                row {
                    text("Gitpod is an open-source Kubernetes application for automated and ready-to-code development environments that blends in your existing workflow. It enables you to describe your dev environment as code and start instant and fresh development environments for each new task directly from your browser.")
                }
                row {
                    text("Tightly integrated with GitLab, GitHub, and Bitbucket, Gitpod automatically and continuously prebuilds dev environments for all your branches. As a result, team members can instantly start coding with fresh, ephemeral and fully-compiled dev environments - no matter if you are building a new feature, want to fix a bug or do a code review.")
                }
                row {
                    browserLink("Explore Gitpod", "https://www.gitpod.io/")
                }
                row {
                    label("Start from any GitLab, GitHub or Bitbucket URL:")
                }.topGap(TopGap.MEDIUM)
                row {
                    comboBox(backendsModel)
                        .gap(RightGap.SMALL)
                        .visibleIf(backendsLoaded)
                    val contextUrl = textField()
                        .resizableColumn()
                        .horizontalAlign(HorizontalAlign.FILL)
                        .applyToComponent {
                            this.text = "https://github.com/gitpod-io/spring-petclinic"
                        }
                    button("New Workspace") {
                        // TODO(ak) disable button if blank
                        if (contextUrl.component.text.isNotBlank()) {
                            val backend = backendsModel.selectedItem
                            val selectedBackendId = if (backend != null) {
                                backendToId[backend]
                            } else null
                            val backendParam = if (selectedBackendId != null) {
                                ":$selectedBackendId"
                            } else {
                                ""
                            }
                            BrowserUtil.browse("https://${settings.gitpodHost}#referrer:jetbrains-gateway$backendParam/${contextUrl.component.text}")
                        }
                    }
                    cell()
                }.topGap(TopGap.NONE)
            }
            row {
                resizableRow()
                panel {
                    verticalAlign(VerticalAlign.BOTTOM)
                    separator(null, WelcomeScreenUIManager.getSeparatorColor())
                    indent {
                        row {
                            button("Back") {
                                getInstance().reset()
                            }
                        }
                    }
                }
            }.bottomGap(BottomGap.SMALL)
        }.apply {
            this.background = WelcomeScreenUIManager.getMainAssociatedComponentBackground()
        }

        init {
            val updatesJob = Job()
            val updates = GlobalScope.actor<Void?>(updatesJob, capacity = Channel.CONFLATED) {
                for (event in channel) {
                    ensureActive()

                    val gitpodHost = settings.gitpodHost
                    if (!GitpodAuthService.hasAccessToken(gitpodHost)) {
                        backendsModel.removeAllElements()
                        backendToId.clear()
                    } else {
                        val client = service<GitpodConnectionService>().obtainClient(gitpodHost)
                        val ideOptions = client.server.ideOptions.await()
                        ensureActive()

                        val toRemove = HashSet(backendToId.keys)
                        val clientOptions = ideOptions.clients?.get("jetbrains-gateway")
                        if (clientOptions?.desktopIDEs != null) {
                            for (backendId in clientOptions.desktopIDEs) {
                                val option = ideOptions.options[backendId]
                                if (option != null) {
                                    toRemove.remove(option.title)
                                    backendsModel.addElement(option.title)
                                    backendToId[option.title] = backendId
                                }
                            }
                        }
                        for (title in toRemove) {
                            backendsModel.removeElement(title)
                            backendToId.remove(title)
                        }

                        var selectedOption: IDEOption? = null
                        // TODO(ak) apply user option from settings
                        if (clientOptions?.defaultDesktopIDE != null) {
                            selectedOption = ideOptions.options[clientOptions.defaultDesktopIDE]
                        }
                        if (selectedOption != null) {
                            backendsModel.selectedItem = selectedOption.title
                        }
                    }
                    backendsLoadedDispatcher.multicaster.stateChanged()
                }
            }
            lifetime.onTerminationOrNow {
                updatesJob.cancel()
                updates.close()
            }
            fun update() {
                updates.trySend(null)
            }

            update()
            val toDispose = CompositeDisposable()
            toDispose.add(settings.addListener { update() })
            toDispose.add(GitpodAuthService.addListener { update() })
            lifetime.onTerminationOrNow { toDispose.dispose() }
        }

    }

    private class GitpodRecentConnections(
        val setContentCallback: (Component) -> Unit
    ) : GatewayRecentConnections {

        private val settings = service<GitpodSettingsState>()

        override val recentsIcon = GitpodIcons.Logo

        private lateinit var scheduleUpdate: () -> Unit
        override fun createRecentsView(lifetime: Lifetime): JComponent {
            val loggedIn = object : ComponentPredicate() {
                override fun addListener(listener: (Boolean) -> Unit) {
                    val toDispose = CompositeDisposable()
                    toDispose.add(settings.addListener { listener(invoke()) })
                    toDispose.add(GitpodAuthService.addListener { listener(invoke()) })
                    lifetime.onTerminationOrNow { toDispose.dispose() }
                }

                override fun invoke(): Boolean {
                    return GitpodAuthService.hasAccessToken(settings.gitpodHost)
                }
            }
            lateinit var workspacesPane: JBScrollPane
            val view = panel {
                indent {
                    row {
                        label("Gitpod Workspaces").applyToComponent {
                            this.font = JBFont.h3().asBold()
                        }
                    }.topGap(TopGap.MEDIUM).bottomGap(BottomGap.SMALL)

                    row {
                        panel {
                            verticalAlign(VerticalAlign.CENTER)
                            for (i in 1..10) {
                                row {
                                    label("")
                                }
                            }
                            row {
                                resizableRow()
                                icon(GitpodIcons.Logo4x)
                                    .horizontalAlign(HorizontalAlign.CENTER)
                            }
                            row {
                                text(
                                    "Spin up fresh, automated dev environments for each task, in the cloud, in seconds.",
                                    35
                                ).applyToComponent {
                                    val attrs = SimpleAttributeSet()
                                    StyleConstants.setAlignment(attrs, StyleConstants.ALIGN_CENTER)
                                    (document as StyledDocument).setParagraphAttributes(
                                        0,
                                        document.length - 1,
                                        attrs,
                                        false
                                    )
                                }.horizontalAlign(HorizontalAlign.CENTER)
                            }
                            row {
                                browserLink("Explore Gitpod", "https://www.gitpod.io")
                                    .horizontalAlign(HorizontalAlign.CENTER)
                            }.bottomGap(BottomGap.MEDIUM)
                            row {
                                button("Connect") {
                                    GlobalScope.launch {
                                        GitpodAuthService.authorize(settings.gitpodHost)
                                    }
                                }.horizontalAlign(HorizontalAlign.CENTER)
                            }
                        }
                    }.visibleIf(loggedIn.not())

                    rowsRange {
                        row {
                            link("Open Dashboard") {
                                BrowserUtil.browse("https://${settings.gitpodHost}")
                            }
                            label("").resizableColumn().horizontalAlign(HorizontalAlign.FILL)
                            actionButton(object :
                                DumbAwareAction("New Workspace", "Create a new workspace", AllIcons.General.Add) {
                                override fun actionPerformed(e: AnActionEvent) {
                                    val connectorView = GitpodConnectorView(lifetime.createNested())
                                    setContentCallback(connectorView.component)
                                }
                            }).gap(RightGap.SMALL)
                            actionButton(object :
                                DumbAwareAction("Refresh", "Refresh recent workspaces", AllIcons.Actions.Refresh) {
                                override fun actionPerformed(e: AnActionEvent) {
                                    scheduleUpdate()
                                }
                            })
                            cell()
                        }
                        row {
                            resizableRow()
                            workspacesPane = cell(JBScrollPane())
                                .resizableColumn()
                                .horizontalAlign(HorizontalAlign.FILL)
                                .verticalAlign(VerticalAlign.FILL)
                                .component
                            cell()
                        }
                        row {
                            label("").resizableColumn().horizontalAlign(HorizontalAlign.FILL)
                            button("Logout") {
                                GitpodAuthService.setAccessToken(settings.gitpodHost, null)
                            }
                            cell()
                        }.topGap(TopGap.SMALL).bottomGap(BottomGap.SMALL)
                    }.visibleIf(loggedIn)
                }
            }.apply {
                this.background = WelcomeScreenUIManager.getMainAssociatedComponentBackground()
            }
            this.scheduleUpdate = startUpdateLoop(lifetime, workspacesPane)

            scheduleUpdate()
            loggedIn.addListener { scheduleUpdate() }
            return view
        }

        override fun getRecentsTitle(): String {
            return "Gitpod"
        }

        override fun updateRecentView() {
            if (this::scheduleUpdate.isInitialized) {
                scheduleUpdate()
            }
        }

        private fun startUpdateLoop(lifetime: Lifetime, workspacesPane: JBScrollPane): () -> Unit {
            val updateJob = Job()
            lifetime.onTerminationOrNow { updateJob.cancel() }

            val updateActor = GlobalScope.actor<Void?>(updateJob, capacity = Channel.CONFLATED) {
                var updateLifetime: LifetimeDefinition? = null
                for (event in channel) {
                    ensureActive()
                    updateLifetime?.terminate()
                    updateLifetime = lifetime.createNested()
                    doUpdate(updateLifetime, workspacesPane);
                }
            }
            lifetime.onTerminationOrNow { updateActor.close() }

            return { updateActor.trySend(null) }
        }

        private fun doUpdate(updateLifetime: Lifetime, workspacesPane: JBScrollPane) {
            val gitpodHost = settings.gitpodHost
            if (!GitpodAuthService.hasAccessToken(gitpodHost)) {
                ApplicationManager.getApplication().invokeLater {
                    if (updateLifetime.isAlive) {
                        workspacesPane.viewport.view = panel {
                            row {
                                comment("Loading...")
                            }
                        }
                    }
                }
                return
            }
            val job = GlobalScope.launch {
                val client = service<GitpodConnectionService>().obtainClient(gitpodHost)
                val workspaces = client.server.getWorkspaces(GetWorkspacesOptions().apply {
                    this.limit = 20
                }).await()
                val workspacesMap = workspaces.associateBy { it.workspace.id }.toMutableMap()
                fun updateView() {
                    val view = panel {
                        for (info in workspacesMap.values) {
                            if (info.latestInstance == null) {
                                continue;
                            }
                            indent {
                                row {
                                    var canConnect = false
                                    icon(
                                        if (info.latestInstance.status.phase == "running") {
                                            canConnect = true
                                            GitpodIcons.Running
                                        } else if (info.latestInstance.status.phase == "stopped") {
                                            if (info.latestInstance.status.conditions.failed.isNullOrBlank()) {
                                                GitpodIcons.Stopped
                                            } else {
                                                GitpodIcons.Failed
                                            }
                                        } else if (info.latestInstance.status.phase == "interrupted") {
                                            GitpodIcons.Failed
                                        } else if (info.latestInstance.status.phase == "unknown") {
                                            GitpodIcons.Failed
                                        } else {
                                            canConnect = true
                                            GitpodIcons.Starting
                                        }
                                    ).gap(RightGap.SMALL)
                                    panel {
                                        row {
                                            browserLink(info.workspace.id, info.latestInstance.ideUrl)
                                        }.rowComment("<a href='${info.workspace.context.normalizedContextURL}'>${info.workspace.context.normalizedContextURL}</a>")
                                    }
                                    label("").resizableColumn().horizontalAlign(HorizontalAlign.FILL)
                                    button("Connect") {
                                        if (!canConnect) {
                                            BrowserUtil.browse(info.latestInstance.ideUrl)
                                        } else {
                                            getInstance().connect(
                                                mapOf(
                                                    "gitpodHost" to gitpodHost,
                                                    "workspaceId" to info.workspace.id
                                                )
                                            )
                                        }
                                    }
                                    cell()
                                }
                            }
                        }
                    }
                    ApplicationManager.getApplication().invokeLater {
                        if (updateLifetime.isAlive) {
                            workspacesPane.viewport.view = view
                        }
                    }
                }
                updateView()
                val updates = client.listenToWorkspace(updateLifetime, "*")
                for (update in updates) {
                    if (updateLifetime.isNotAlive) {
                        return@launch
                    }
                    var info = workspacesMap[update.workspaceId]
                    if (info == null) {
                        try {
                            info = client.syncWorkspace(update.workspaceId)
                        } catch (t: Throwable) {
                            thisLogger().error("${gitpodHost}: ${update.workspaceId}: failed to sync", t)
                            continue
                        }
                        workspacesMap[update.workspaceId] = info
                    } else if (WorkspaceInstance.isUpToDate(info.latestInstance, update)) {
                        continue
                    } else {
                        info.latestInstance = update
                    }
                    updateView()
                }
            }
            updateLifetime.onTerminationOrNow { job.cancel() }
        }
    }
}