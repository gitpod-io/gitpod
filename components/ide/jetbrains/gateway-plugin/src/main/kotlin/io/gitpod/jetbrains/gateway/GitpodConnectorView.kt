// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.openapi.wm.impl.welcomeScreen.WelcomeScreenUIManager
import com.intellij.ui.dsl.builder.BottomGap
import com.intellij.ui.dsl.builder.panel
import com.intellij.ui.dsl.gridLayout.HorizontalAlign
import com.intellij.ui.dsl.gridLayout.VerticalAlign
import com.jetbrains.gateway.api.GatewayConnectorView
import com.jetbrains.gateway.api.GatewayUI
import com.jetbrains.rd.util.lifetime.Lifetime

class GitpodConnectorView(
    lifetime: Lifetime
) : GatewayConnectorView {

    private val workspaces = GitpodWorkspacesView(lifetime)

    override val component = panel {
        row {
            resizableRow()
            cell(workspaces.component)
                .resizableColumn()
                .horizontalAlign(HorizontalAlign.FILL)
                .verticalAlign(VerticalAlign.FILL)
            cell()
        }
        row {
            panel {
                verticalAlign(VerticalAlign.BOTTOM)
                separator(null, WelcomeScreenUIManager.getSeparatorColor())
                indent {
                    row {
                        button("Back") {
                            GatewayUI.getInstance().reset()
                        }
                    }
                }
            }
        }.bottomGap(BottomGap.SMALL)
    }.apply {
        this.background = WelcomeScreenUIManager.getMainAssociatedComponentBackground()
    }

}