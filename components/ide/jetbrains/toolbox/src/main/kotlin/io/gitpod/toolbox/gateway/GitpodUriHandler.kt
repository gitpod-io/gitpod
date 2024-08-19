// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import io.gitpod.toolbox.service.ConnectParams
import io.gitpod.toolbox.utils.GitpodLogger
import java.net.URI
import java.util.concurrent.Future

interface UriHandler<T> {
    fun parseUri(uri: URI): T
    fun handle(data: T): Future<Void?>
    fun tryHandle(uri: URI): Boolean
}

abstract class AbstractUriHandler<T> : UriHandler<T> {
    abstract override fun parseUri(uri: URI): T
    abstract override fun handle(data: T): Future<Void?>

    override fun tryHandle(uri: URI) = try {
        val data = parseUri(uri)
        handle(data)
        true
    } catch (e: Exception) {
        GitpodLogger.warn("cannot parse URI", e)
        false
    }
}

class GitpodOpenInToolboxUriHandler(val handler: (Pair<String, ConnectParams>) -> Future<Void?>) : AbstractUriHandler<Pair<String, ConnectParams>>() {

    override fun handle(data: Pair<String, ConnectParams>): Future<Void?> {
        return handler(data)
    }

    override fun parseUri(uri: URI): Pair<String, ConnectParams> {
        val path = uri.path.split("/").last()
        if (path != "open-in-toolbox") {
            throw IllegalArgumentException("invalid URI: $path")
        }
        val query = uri.query ?: throw IllegalArgumentException("invalid URI: ${uri.query}")
        val params = query.split("&").map { it.split("=") }.associate { it[0] to it[1] }
        val host = params["host"]
        val workspaceId = params["workspaceId"]
        val debugWorkspace = params["debugWorkspace"]?.toBoolean() ?: false

        if (host.isNullOrEmpty() || workspaceId.isNullOrEmpty()) {
            throw IllegalArgumentException("invalid URI: host or workspaceId is missing: $uri")
        }

        try {
            URI.create(host)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException("invalid host: $host")
        }
        GitpodLogger.debug("parsed URI: $host, $workspaceId, $debugWorkspace")
        val gitpodHost = "https://$host"
        return Pair(gitpodHost, ConnectParams(workspaceId, gitpodHost, debugWorkspace))
    }
}
