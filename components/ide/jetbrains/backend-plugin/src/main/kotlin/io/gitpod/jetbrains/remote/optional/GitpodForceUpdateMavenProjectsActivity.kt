// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.optional

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import org.jetbrains.idea.maven.project.MavenProjectsManager

class GitpodForceUpdateMavenProjectsActivity : StartupActivity.RequiredForSmartMode {
    override fun runActivity(project: Project) {
        MavenProjectsManager.getInstance(project).forceUpdateAllProjectsOrFindAllAvailablePomFiles()
        thisLogger().warn("gitpod: Forced the update of Maven projects.")
    }
}
