// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import io.gitpod.jetbrains.remote.GitpodManager
import org.apache.http.client.utils.URIBuilder

class GitpodTimeoutControlCenterTabProvider : GatewayControlCenterTabProvider {
    override val id = "gitpodTimeoutTab"
    override val title = "Timeout"

    override fun getControl(lifetime: Lifetime): BeControl {
        return scrollablePanel(lifetime) {
            verticalLayout {
                label("Gitpod Tab")
                label("Current workspace timeout: 30 minutes")
                button("Extend workspace timeout") {
                    action {
                        actionManager.tryToExecute("io.gitpod.jetbrains.remote.actions.ExtendWorkspaceTimeoutAction", null, null, null, true)
                    }
                }
            }
        }
    }
}
