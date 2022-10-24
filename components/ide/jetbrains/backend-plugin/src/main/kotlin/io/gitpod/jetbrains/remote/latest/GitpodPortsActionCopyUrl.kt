// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.latest

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.ide.CopyPasteManager
import com.jetbrains.rd.platform.codeWithMe.portForwarding.PortForwardingDataKeys
import java.awt.datatransfer.StringSelection

@Suppress("ComponentNotRegistered", "UnstableApiUsage")
class GitpodPortsActionCopyUrl : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val port = e.dataContext.getData(PortForwardingDataKeys.PORT)
        if (port != null) {
            thisLogger().warn("gitpod: Exec GitpodPortsActionCopyUrl: ${port.hostPortNumber}")
            CopyPasteManager.getInstance().setContents(StringSelection(port.hostPortNumber.toString()))
        } else {
            thisLogger().warn("gitpod: Exec: GitpodPortsActionCopyUrl: error unknown port")
        }
    }
}
