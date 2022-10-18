// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway.stable

import com.jetbrains.gateway.api.GatewayConnector
import com.jetbrains.gateway.api.GatewayConnectorView
import com.jetbrains.gateway.api.GatewayRecentConnections
import com.jetbrains.rd.util.lifetime.Lifetime
import io.gitpod.jetbrains.icons.GitpodIcons
import java.awt.Component
import javax.swing.Icon
import javax.swing.JComponent
import com.intellij.ui.components.ActionLink
import com.intellij.ide.BrowserUtil
import io.gitpod.jetbrains.gateway.GitpodRecentConnections

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

    override fun getDocumentationLink(): ActionLink {
        val documentationLink = ActionLink("Documentation") {
            BrowserUtil.browse("https://www.gitpod.io/docs/ides-and-editors/jetbrains-gateway")
        }
        documentationLink.setExternalLinkIcon()
        return documentationLink
    }

    override fun getConnectorId(): String = "gitpod.connector"

    override fun getRecentConnections(setContentCallback: (Component) -> Unit): GatewayRecentConnections? {
        return GitpodRecentConnections()
    }

    override fun getTitle(): String {
        return "Gitpod"
    }

    override fun getTitleAdornment(): JComponent? {
        return null
    }

    override fun initProcedure() {}
}
