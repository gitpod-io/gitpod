// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import io.gitpod.publicapi.experimental.v1.Workspaces.Workspace
import io.gitpod.toolbox.utils.await
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.Request
import java.net.URL

fun Workspace.getConnectParams(): ConnectParams {
    return ConnectParams(workspaceId, getGitpodHost(), false)
}

fun Workspace.getIDEUrl(): String {
    return status.instance.status.url
}

fun Workspace.getGitpodHost(): String {
    val ideUrl = URL(getIDEUrl())
    val hostSegments = ideUrl.host.split(".")
    return hostSegments.takeLast(2).joinToString(".")
}

@Serializable
class JoinLink2Response(val appPid: Int, val joinLink: String, val ideVersion: String, val projectPath: String)

suspend fun Workspace.fetchJoinLink2Info(ownerToken: String): JoinLink2Response {
    val backendUrl = "https://24000-${URL(getIDEUrl()).host}/joinLink2"
    val client = Utils.httpClient
    val req = Request.Builder().url(backendUrl).header("x-gitpod-owner-token", ownerToken)
    val response = client.newCall(req.build()).await()
    if (!response.isSuccessful) {
        throw IllegalStateException("Failed to get join link $backendUrl info: ${response.code} ${response.message}")
    }
    if (response.body == null) {
        throw IllegalStateException("Failed to get join link $backendUrl info: no body")
    }
    return Json.decodeFromString<JoinLink2Response>(response.body!!.string())
}

