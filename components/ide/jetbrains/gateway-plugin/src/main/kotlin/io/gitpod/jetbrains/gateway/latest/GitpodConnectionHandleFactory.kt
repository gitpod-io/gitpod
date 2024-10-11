// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway.latest

import com.intellij.openapi.components.Service
import com.jetbrains.gateway.api.GatewayConnectionHandle
import com.jetbrains.gateway.ssh.ClientOverSshTunnelConnector
import com.jetbrains.gateway.ssh.HostTunnelConnector
import com.jetbrains.gateway.thinClientLink.ThinClientHandle
import com.jetbrains.rd.util.lifetime.Lifetime
import io.gitpod.jetbrains.gateway.GitpodConnectionProvider.ConnectParams
import io.gitpod.jetbrains.gateway.common.GitpodConnectionHandle
import io.gitpod.jetbrains.gateway.common.GitpodConnectionHandleFactory
import java.net.URI
import javax.swing.JComponent

@Suppress("UnstableApiUsage")
class LatestGitpodConnectionHandleFactory: GitpodConnectionHandleFactory {
    override fun createGitpodConnectionHandle(
        lifetime: Lifetime,
        component: JComponent,
        params: ConnectParams
    ): GatewayConnectionHandle {
        return GitpodConnectionHandle(lifetime, component, params)
    }

    override suspend fun connect(lifetime: Lifetime, connector: HostTunnelConnector, tcpJoinLink: URI): ThinClientHandle {
        return ClientOverSshTunnelConnector(
            lifetime,
            connector
        ).connect(tcpJoinLink, null)
    }
}
