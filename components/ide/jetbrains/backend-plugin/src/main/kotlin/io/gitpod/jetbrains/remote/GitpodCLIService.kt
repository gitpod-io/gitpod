// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.components.service
import com.intellij.openapi.util.io.BufferExposingByteArrayOutputStream
import com.intellij.util.application
import io.netty.buffer.Unpooled
import io.netty.channel.ChannelHandlerContext
import io.netty.handler.codec.http.FullHttpRequest
import io.netty.handler.codec.http.QueryStringDecoder
import io.prometheus.client.exporter.common.TextFormat
import org.jetbrains.ide.RestService
import org.jetbrains.io.response
import java.io.OutputStreamWriter

@Suppress("UnstableApiUsage", "OPT_IN_USAGE")
class GitpodCLIService : RestService() {

    private val manager = service<GitpodManager>()

    override fun getServiceName() = SERVICE_NAME

    override fun execute(urlDecoder: QueryStringDecoder, request: FullHttpRequest, context: ChannelHandlerContext): String? {
        val operation = getStringParameter("op", urlDecoder)
        if (application.isHeadlessEnvironment) {
            return "not supported in headless mode"
        }
        /**
         * prod: curl http://localhost:63342/api/gitpod/cli?op=metrics
         * dev:  curl http://localhost:63343/api/gitpod/cli?op=metrics
         */
        if (operation == "metrics") {
            val out = BufferExposingByteArrayOutputStream()
            val writer = OutputStreamWriter(out)
            TextFormat.write004(writer, manager.registry.metricFamilySamples())
            writer.close()
            val response = response(TextFormat.CONTENT_TYPE_004, Unpooled.wrappedBuffer(out.internalBuffer, 0, out.size()))
            sendResponse(request, context, response)
            return null
        }
        return "invalid operation"
    }

    companion object {
        const val SERVICE_NAME = "gitpod/cli"
    }
}
