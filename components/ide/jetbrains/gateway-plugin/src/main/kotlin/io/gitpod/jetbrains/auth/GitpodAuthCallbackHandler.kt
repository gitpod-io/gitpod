// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.auth

import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.wm.IdeFocusManager
import com.intellij.ui.AppIcon
import io.netty.buffer.Unpooled
import io.netty.channel.ChannelHandlerContext
import io.netty.handler.codec.http.FullHttpRequest
import io.netty.handler.codec.http.QueryStringDecoder
import org.jetbrains.ide.RestService
import org.jetbrains.io.response
import java.nio.charset.StandardCharsets

internal class GitpodAuthCallbackHandler : RestService() {
    private val service = GitpodAuthService.instance

    override fun getServiceName(): String = service.name

    override fun execute(
        urlDecoder: QueryStringDecoder,
        request: FullHttpRequest,
        context: ChannelHandlerContext
    ): String? {
        service.handleServerCallback(urlDecoder.path(), urlDecoder.parameters())
        sendResponse(
            request,
            context,
            response("text/html", Unpooled.wrappedBuffer(responseHTML.toByteArray(StandardCharsets.UTF_8)))
        )
        invokeLater {
            val toFocus = IdeFocusManager.getGlobalInstance()?.lastFocusedFrame
            if (toFocus != null) {
                AppIcon.getInstance().requestFocus(toFocus)
            }
        }
        return null
    }

    companion object {
        private val responseHTML = """
                <html>
                	<head>
                    	<meta charset="utf-8">
                    	<title>Done</title>
                		<script>
                			if (window.opener) {
                				const message = new URLSearchParams(window.location.search).get("message");
                				window.opener.postMessage(message, "https://" + window.location.hostname);
                			} else {
                				console.log("This page was not opened by Gitpod.")
                				setTimeout("window.close();", 1000);
                			}
                		</script>
                	</head>
                	<body>
                		If this tab is not closed automatically, feel free to close it and proceed. <button type="button" onclick="window.open('', '_self', ''); window.close();">Close</button>
                	</body>
                </html>
            """.trimIndent()
    }
}