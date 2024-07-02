// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.environments.ManualEnvironmentContentsView
import com.jetbrains.toolbox.gateway.environments.SshEnvironmentContentsView
import com.jetbrains.toolbox.gateway.ssh.SshConnectionInfo
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.service.GitpodConnectionProvider
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.future.future
import org.slf4j.LoggerFactory
import java.util.concurrent.CompletableFuture

class GitpodSSHEnvironmentContentsView(
    private val authManager: GitpodAuthManager,
    private val workspaceId: String,
    private val publicApi: GitpodPublicApiManager,
) : SshEnvironmentContentsView, ManualEnvironmentContentsView {
    private var cancel = {}
    private val stateListeners = mutableSetOf<ManualEnvironmentContentsView.Listener>()

    private val logger = LoggerFactory.getLogger(javaClass)

    override fun getConnectionInfo(): CompletableFuture<SshConnectionInfo> {
        return Utils.coroutineScope.future {
            val provider = GitpodConnectionProvider(authManager, workspaceId, publicApi)
            val (connInfo, cancel) = provider.connect()
            this@GitpodSSHEnvironmentContentsView.cancel = cancel
            return@future connInfo
        }
    }

    override fun addEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
        stateListeners += p0
    }

    override fun removeEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
        stateListeners -= p0
    }

    override fun close() {
        cancel()
    }
}
