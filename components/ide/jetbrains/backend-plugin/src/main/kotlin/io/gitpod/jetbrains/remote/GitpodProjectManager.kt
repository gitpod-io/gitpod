// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.projectRoots.ProjectJdkTable
import com.intellij.openapi.roots.ProjectRootManager
import com.intellij.util.application

class GitpodProjectManager(
        private val project: Project
) {

    init {
        application.invokeLaterOnWriteThread {
            application.runWriteAction {
                configureSdk()
            }
        }
    }

    /**
     * It is a workaround for https://youtrack.jetbrains.com/issue/GTW-88
     */
    private fun configureSdk() {
        ProjectJdkTable.getInstance().preconfigure()
        val sdk = ProjectJdkTable.getInstance().allJdks.firstOrNull() ?: return
        val projectRootManager = ProjectRootManager.getInstance(project)
        if (projectRootManager.projectSdk != null) {
            return
        }
        projectRootManager.projectSdk = sdk
        thisLogger().warn("gitpod: SDK was auto preconfigured: $sdk")
    }
}