// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.optional

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.util.registry.Registry
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.util.application
import org.jetbrains.idea.maven.project.MavenProjectsManager

class GitpodForceUpdateMavenProjectsActivity : StartupActivity.RequiredForSmartMode {
    override fun runActivity(project: Project) {
        if (application.isHeadlessEnvironment  || Registry.get("gitpod.forceUpdateMavenProjects.disabled").asBoolean()) {
            return
        }
        application.invokeLater {
            VirtualFileManager.getInstance().asyncRefresh {
                MavenProjectsManager.getInstance(project).forceUpdateAllProjectsOrFindAllAvailablePomFiles()
                thisLogger().warn("gitpod: Forced the update of Maven projects.")
            }
        }
    }
}
