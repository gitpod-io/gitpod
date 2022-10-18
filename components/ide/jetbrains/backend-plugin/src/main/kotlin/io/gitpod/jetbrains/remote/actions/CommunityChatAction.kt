// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import io.gitpod.jetbrains.remote.GitpodManager

class CommunityChatAction : AnAction() {
    private val manager = service<GitpodManager>()

    override fun actionPerformed(event: AnActionEvent) {
        manager.openUrlFromAction("https://www.gitpod.io/chat")
    }
}
