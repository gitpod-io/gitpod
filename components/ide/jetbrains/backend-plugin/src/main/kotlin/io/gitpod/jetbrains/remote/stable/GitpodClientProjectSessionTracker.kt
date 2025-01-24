// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable

import com.intellij.openapi.client.ClientProjectSession
import com.intellij.openapi.client.ClientSessionsManager
import com.intellij.openapi.project.Project
import io.gitpod.jetbrains.remote.AbstractGitpodClientProjectSessionTracker

@Suppress("UnstableApiUsage")
class GitpodClientProjectSessionTracker(val project: Project) : AbstractGitpodClientProjectSessionTracker(project) {
    override val session: ClientProjectSession? = ClientSessionsManager.getProjectSession(project)
}
