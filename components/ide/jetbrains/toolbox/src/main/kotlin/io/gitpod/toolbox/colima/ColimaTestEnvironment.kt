// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.colima

import com.jetbrains.toolbox.gateway.AbstractRemoteProviderEnvironment
import com.jetbrains.toolbox.gateway.EnvironmentVisibilityState
import com.jetbrains.toolbox.gateway.environments.EnvironmentContentsView
import com.jetbrains.toolbox.gateway.environments.ManualEnvironmentContentsView
import com.jetbrains.toolbox.gateway.environments.SshEnvironmentContentsView
import com.jetbrains.toolbox.gateway.ssh.SshConnectionInfo
import com.jetbrains.toolbox.gateway.states.StandardRemoteEnvironmentState
import com.jetbrains.toolbox.gateway.ui.ActionDescription
import com.jetbrains.toolbox.gateway.ui.ActionListener
import com.jetbrains.toolbox.gateway.ui.ObservableList
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.launch
import java.util.concurrent.CompletableFuture

class ColimaTestEnvironment() : AbstractRemoteProviderEnvironment() {
    private val actionListeners = mutableSetOf<ActionListener>()
    private val contentsViewFuture: CompletableFuture<EnvironmentContentsView> =
        CompletableFuture.completedFuture(ColimaSSHEnvironmentContentsView())

    init {
        Utils.coroutineScope.launch {
            Thread.sleep(2000)
            listenerSet.forEach { it.consume(StandardRemoteEnvironmentState.Active) }
        }
    }

    override fun getId(): String = "colima"
    override fun getName(): String = "colima"

    override fun getContentsView(): CompletableFuture<EnvironmentContentsView> = contentsViewFuture

    override fun setVisible(visibilityState: EnvironmentVisibilityState) {

    }

    override fun getActionList(): ObservableList<ActionDescription> {
        return Utils.observablePropertiesFactory.emptyObservableList()
    }

}

class ColimaSSHEnvironmentContentsView : SshEnvironmentContentsView, ManualEnvironmentContentsView {
    private val listenerSet = mutableSetOf<ManualEnvironmentContentsView.Listener>()

    override fun getConnectionInfo(): CompletableFuture<SshConnectionInfo> {
        return CompletableFuture.completedFuture(object : SshConnectionInfo {
            override fun getHost(): String = "127.0.0.1"
            override fun getPort() = 51710
            override fun getUserName() = "hwen"
            override fun getPrivateKeyPaths(): MutableList<String>? {
                return mutableListOf("/Users/hwen/.colima/_lima/_config/user")
            }
        })
    }

    override fun addEnvironmentContentsListener(listener: ManualEnvironmentContentsView.Listener) {
        listenerSet += listener
    }

    override fun removeEnvironmentContentsListener(listener: ManualEnvironmentContentsView.Listener) {
        listenerSet -= listener
    }

}
