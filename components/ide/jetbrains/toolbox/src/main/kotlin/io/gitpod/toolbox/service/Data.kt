// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import io.gitpod.publicapi.experimental.v1.Workspaces.Workspace
import io.gitpod.publicapi.experimental.v1.Workspaces.WorkspaceInstanceStatus
import java.net.URI

fun Workspace.getConnectParams(): ConnectParams {
    return ConnectParams(workspaceId, getGitpodHost(), false)
}

fun Workspace.getIDEUrl(): String {
    return status.instance.status.url
}

fun Workspace.getGitpodHost(): String {
    val ideUrl = URI(getIDEUrl()).toURL()
    val hostSegments = ideUrl.host.split(".")
    return hostSegments.takeLast(2).joinToString(".")
}

val JetBrainsEditors = setOf("intellij", "pycharm", "webstorm", "clion", "goland", "rider", "phpstorm", "rubymine")
fun WorkspaceInstanceStatus.shouldListedInEnvironments() : Boolean {
    return editor.preferToolbox && JetBrainsEditors.contains(editor.name)
}

fun Workspace.getTunnelUrl(): String {
    val workspaceHost = URI.create(status.instance.status.url).host
    return "wss://${workspaceHost}/_supervisor/tunnel/ssh"
}

fun WorkspaceInstanceStatus.getIDEUrl(): String {
    return url
}

