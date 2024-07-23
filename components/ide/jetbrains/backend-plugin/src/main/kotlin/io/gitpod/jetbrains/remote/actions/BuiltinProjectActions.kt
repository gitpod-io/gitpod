// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.task.ProjectTaskManager

class BuiltinProjectBuildAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        thisLogger().warn("gitpod: triggered project build all")
        val project = e.project ?: throw Exception("project not found")
        val projectTaskManager = ProjectTaskManager.getInstance(project)
        projectTaskManager.buildAllModules()
    }
}

class BuiltinProjectRebuildAllModulesAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        thisLogger().warn("gitpod: triggered project rebuild all modules action")
        val project = e.project ?: throw Exception("project not found")
        val projectTaskManager = ProjectTaskManager.getInstance(project)
        projectTaskManager.rebuildAllModules()
    }
}
