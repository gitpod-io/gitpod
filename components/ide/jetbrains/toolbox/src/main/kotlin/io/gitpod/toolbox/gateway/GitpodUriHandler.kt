// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import io.gitpod.toolbox.service.ConnectParams
import org.slf4j.LoggerFactory
import java.net.URI
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Future

interface UriHandler<T> {
    fun parseUri(uri: URI): T
    fun handle(data: T): Future<Void?>
    fun tryHandle(uri: URI): Boolean
}

abstract class AbstractUriHandler<T> : UriHandler<T> {
    private val logger = LoggerFactory.getLogger(javaClass)
    abstract override fun parseUri(uri: URI): T
    abstract override fun handle(data: T): Future<Void?>

    override fun tryHandle(uri: URI) = try {
        val data = parseUri(uri)
        handle(data)
        true
    } catch (e: Exception) {
        logger.warn("cannot parse URI", e)
        false
    }
}

class GitpodOpenInToolboxUriHandler(val handler: (ConnectParams) -> Unit) : AbstractUriHandler<ConnectParams>() {
    override fun handle(data: ConnectParams): Future<Void?> = CompletableFuture.runAsync { handler(data) }

    override fun parseUri(uri: URI): ConnectParams {
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

        return ConnectParams(host, workspaceId, debugWorkspace)
    }
}
