// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.maven

import com.intellij.openapi.project.Project
import org.jetbrains.idea.maven.project.MavenProjectsManager

class GitpodMavenProjectManager(
        private val project: Project
) {

    init {
        // force initialize maven project
        MavenProjectsManager.getInstance(project)
    }

}
