// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory

class GitpodSystemMetricsFactory : StatusBarWidgetFactory {
    override fun getId(): String = "GitpodSystemMetricsWidget"

    override fun getDisplayName(): String = "Gitpod System Metrics"

    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget =
        GitpodSystemMetricsWidget(project)

    override fun disposeWidget(widget: StatusBarWidget) {
        widget.dispose()
    }
}
