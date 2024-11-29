// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.environments.CachedIdeStub
import com.jetbrains.toolbox.gateway.environments.CachedProjectStub
import com.jetbrains.toolbox.gateway.environments.ManualEnvironmentContentsView
import com.jetbrains.toolbox.gateway.environments.SshEnvironmentContentsView
import com.jetbrains.toolbox.gateway.ssh.SshConnectionInfo
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.service.ConnectParams
import io.gitpod.toolbox.service.GitpodConnectionProvider
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import io.gitpod.toolbox.utils.GitpodLogger
import kotlinx.coroutines.future.future
import java.util.concurrent.CompletableFuture

class GitpodSSHEnvironmentContentsView(
    private val authManager: GitpodAuthManager,
    private val connectParams: ConnectParams,
    private val publicApi: GitpodPublicApiManager,
) : SshEnvironmentContentsView, ManualEnvironmentContentsView {
    private var cancel = {}
    private val stateListeners = mutableSetOf<ManualEnvironmentContentsView.Listener>()

    override fun getConnectionInfo(): CompletableFuture<SshConnectionInfo> {
        return Utils.coroutineScope.future {
            val provider = GitpodConnectionProvider(authManager, connectParams, publicApi)
            val (connInfo, cancel) = provider.connect()
            this@GitpodSSHEnvironmentContentsView.cancel = cancel
            GitpodLogger.info("=============test.getConnectionInfo port: ${connInfo.port}")
            return@future connInfo
        }
    }

    override fun addEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
        stateListeners += p0
        stateListeners.forEach{
            // TODO: get from fetchJoinLink2Info
            it.onProjectListUpdated(listOf(object : CachedProjectStub {
                override fun getPath(): String {
                    return "/workspace/template-golang-cli"
                }

                override fun getName(): String? {
                    return "template-golang-cli"
                }

                override fun getIdeHint(): String? {
                    return "GO-243.21565.208"
                }
            }))
            it.onIdeListUpdated(listOf(object: CachedIdeStub {
                override fun getProductCode(): String {
                    return "GO-243.21565.208"
                }

                override fun isRunning(): Boolean? {
                    return true
                }
            }))
        }
    }

    override fun removeEnvironmentContentsListener(p0: ManualEnvironmentContentsView.Listener) {
        stateListeners -= p0
    }

    override fun close() {
        cancel()
    }
}
