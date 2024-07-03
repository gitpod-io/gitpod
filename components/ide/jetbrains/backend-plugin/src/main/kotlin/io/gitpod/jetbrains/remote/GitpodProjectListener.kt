// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import io.gitpod.jetbrains.remote.internal.GitpodTerminalServiceImpl

class GitpodProjectListener: ProjectActivity {
    override suspend fun execute(project: Project) {
        thisLogger().warn("hwen: =====GitpodProjectListener")
        project.getService(GitpodTerminalServiceImpl::class.java)
        project.getService(GitpodClientProjectSessionTracker::class.java)
        thisLogger().warn("hwen: =====GitpodProjectListener.2")
    }
}
