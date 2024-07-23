// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.task.ProjectTaskManager

class BuiltinProjectBuildAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: throw Exception("project not found")
        val projectTaskManager = ProjectTaskManager.getInstance(project)
        projectTaskManager.buildAllModules()
    }
}
