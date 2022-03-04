// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.ide.BrowserUtil
import com.intellij.openapi.CompositeDisposable
import com.intellij.openapi.components.service
import com.intellij.openapi.wm.impl.welcomeScreen.WelcomeScreenUIManager
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.ui.dsl.builder.MAX_LINE_LENGTH_WORD_WRAP
import com.intellij.ui.dsl.builder.RightGap
import com.intellij.ui.dsl.builder.TopGap
import com.intellij.ui.dsl.builder.panel
import com.intellij.ui.dsl.gridLayout.HorizontalAlign
import com.intellij.ui.layout.ComponentPredicate
import com.intellij.util.EventDispatcher
import com.jetbrains.rd.util.concurrentMapOf
import com.jetbrains.rd.util.lifetime.Lifetime
import io.gitpod.gitpodprotocol.api.entities.IDEOption
import io.gitpod.jetbrains.auth.GitpodAuthService
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.actor
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.future.await
import java.util.*
import javax.swing.DefaultComboBoxModel

class GitpodStartWorkspaceView(
    lifetime: Lifetime
) {

    private interface Listener : EventListener {
        fun stateChanged()
    }

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

    val component = panel {
        row {
            label("Start from any GitLab, GitHub or Bitbucket URL:")
        }
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
            .rowComment(
                "Create and start a new workspace via browser. If an IDE does not open automatically, check progress in your browser.",
                MAX_LINE_LENGTH_WORD_WRAP
            )
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