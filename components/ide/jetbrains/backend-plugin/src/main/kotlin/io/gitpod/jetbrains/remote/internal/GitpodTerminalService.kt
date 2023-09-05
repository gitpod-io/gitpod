// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.internal

import com.intellij.openapi.project.Project
import com.jetbrains.rdserver.terminal.BackendTerminalManager
import io.gitpod.jetbrains.remote.AbstractGitpodTerminalService
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalView
import java.util.*

@Suppress("UnstableApiUsage")
class GitpodTerminalService(project: Project): AbstractGitpodTerminalService(project) {

    private val terminalView = TerminalView.getInstance(project)
    private val backendTerminalManager = BackendTerminalManager.getInstance(project)

    override fun createSharedTerminal(title: String): ShellTerminalWidget {
        val shellTerminalWidget = terminalView.createLocalShellWidget(null, title, true, false)
        backendTerminalManager.shareTerminal(shellTerminalWidget, UUID.randomUUID().toString())
        return shellTerminalWidget
    }

}
