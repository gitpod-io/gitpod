// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.eclipse.jetty.client.HttpClient
import org.eclipse.jetty.client.HttpProxy
import org.eclipse.jetty.client.Socks4Proxy
import org.eclipse.jetty.util.ssl.SslContextFactory
import org.eclipse.jetty.websocket.jsr356.ClientContainer
import org.slf4j.LoggerFactory
import java.net.*
import java.nio.ByteBuffer
import java.util.*
import java.util.concurrent.CopyOnWriteArrayList
import javax.net.ssl.SSLContext
import javax.websocket.*
import javax.websocket.ClientEndpointConfig.Configurator
import javax.websocket.MessageHandler.Partial

class GitpodWebSocketTunnelServer(
    private val url: String,
    private val ownerToken: String,
) {
    private val serverSocket = ServerSocket(0) // pass 0 to have the system choose a free port
    private val logger = LoggerFactory.getLogger(javaClass)

    val port: Int
        get() = serverSocket.localPort

    private fun thisLogger() = logger

    private val clients = CopyOnWriteArrayList<GitpodWebSocketTunnelClient>()

    fun start(): () -> Unit {
        val job = Utils.coroutineScope.launch(Dispatchers.IO) {
            thisLogger().info("gitpod: tunnel[$url]: listening on port $port")
            try {
                while (isActive) {
                    try {
                        val clientSocket = serverSocket.accept()
                        launch(Dispatchers.IO) {
                            handleClientConnection(clientSocket)
                        }
                    } catch (t: Throwable) {
                        if (isActive) {
                            thisLogger().error("gitpod: tunnel[$url]: failed to accept", t)
                        }
                    }
                }
            } catch (t: Throwable) {
                if (isActive) {
                    thisLogger().error("gitpod: tunnel[$url]: failed to listen", t)
                }
            } finally {
                thisLogger().info("gitpod: tunnel[$url]: stopped")
            }
        }
        return {
            job.cancel()
            serverSocket.close()
            clients.forEach { it.close() }
            clients.clear()
        }
    }

    private fun handleClientConnection(clientSocket: Socket) {
        val socketClient = GitpodWebSocketTunnelClient(url, clientSocket)
        try {
            val inputStream = clientSocket.getInputStream()
            val outputStream = clientSocket.getOutputStream()

            // Forward data from WebSocket to TCP client
            socketClient.onMessageCallback = { data ->
                outputStream.write(data)
                thisLogger().trace("gitpod: tunnel[$url]: received ${data.size} bytes")
            }

            connectToWebSocket(socketClient)

            clients.add(socketClient)

            val buffer = ByteArray(1024)
            var read: Int
            while (inputStream.read(buffer).also { read = it } != -1) {
                // Forward data from TCP to WebSocket
                socketClient.sendData(buffer.copyOfRange(0, read))
                thisLogger().trace("gitpod: tunnel[$url]: sent $read bytes")
            }
        } catch (t: Throwable) {
            if (t is SocketException && t.message?.contains("Socket closed") == true) {
                return
            }
            thisLogger().error("gitpod: tunnel[$url]: failed to pipe", t)
        } finally {
            clients.remove(socketClient)
            socketClient.close()
        }
    }

    private fun connectToWebSocket(socketClient: GitpodWebSocketTunnelClient) {
        val ssl: SslContextFactory = SslContextFactory.Client()
        ssl.sslContext = SSLContext.getDefault()
        val httpClient = HttpClient(ssl)
        val proxies = Utils.getProxyList()
        for (proxy in proxies) {
            if (proxy.type() == Proxy.Type.DIRECT) {
                continue
            }
            val proxyAddress = proxy.address()
            if (proxyAddress !is InetSocketAddress) {
                thisLogger().warn("gitpod: tunnel[$url]: unexpected proxy: $proxy")
                continue
            }
            val hostName = proxyAddress.hostString
            val port = proxyAddress.port
            if (proxy.type() == Proxy.Type.HTTP) {
                httpClient.proxyConfiguration.proxies.add(HttpProxy(hostName, port))
            } else if (proxy.type() == Proxy.Type.SOCKS) {
                httpClient.proxyConfiguration.proxies.add(Socks4Proxy(hostName, port))
            }
        }
        val container = ClientContainer(httpClient)

        // stop container immediately since we close only when a session is already gone
        container.stopTimeout = 0

        // allow clientContainer to own httpClient (for start/stop lifecycle)
        container.client.addManaged(httpClient)
        container.start()

        // Create config to add custom headers
        val config = ClientEndpointConfig.Builder.create()
            .configurator(object : Configurator() {
                override fun beforeRequest(headers: MutableMap<String, List<String>>) {
                    headers["x-gitpod-owner-token"] = Collections.singletonList(ownerToken)
                    headers["user-agent"] = Collections.singletonList("gitpod-toolbox")
                }
            })
            .build()

        try {
            socketClient.container = container;
            container.connectToServer(socketClient, config, URI(url))
        } catch (t: Throwable) {
            container.stop()
            throw t
        }
    }

}

class GitpodWebSocketTunnelClient(
    private val url: String,
    private val tcpSocket: Socket
) : Endpoint(), Partial<ByteBuffer> {
    private val logger = LoggerFactory.getLogger(javaClass)
    private lateinit var webSocketSession: Session
    var onMessageCallback: ((ByteArray) -> Unit)? = null
    var container: ClientContainer? = null

    private fun thisLogger() = logger

    override fun onOpen(session: Session, config: EndpointConfig) {
        session.addMessageHandler(this)
        this.webSocketSession = session
    }

    override fun onClose(session: Session, closeReason: CloseReason) {
        thisLogger().info("gitpod: tunnel[$url]: closed ($closeReason)")
        this.doClose()
    }

    override fun onError(session: Session?, thr: Throwable?) {
        thisLogger().error("gitpod: tunnel[$url]: failed", thr)
        this.doClose()
    }

    private fun doClose() {
        try {
            tcpSocket.close()
        } catch (t: Throwable) {
            thisLogger().error("gitpod: tunnel[$url]: failed to close socket", t)
        }
        try {
            container?.stop()
        } catch (t: Throwable) {
            thisLogger().error("gitpod: tunnel[$url]: failed to stop container", t)
        }
    }

    fun sendData(data: ByteArray) {
        webSocketSession.asyncRemote.sendBinary(ByteBuffer.wrap(data))
    }

    fun close() {
        try {
            webSocketSession.close()
        } catch (t: Throwable) {
            thisLogger().error("gitpod: tunnel[$url]: failed to close", t)
        }
        try {
            container?.stop()
        } catch (t: Throwable) {
            thisLogger().error("gitpod: tunnel[$url]: failed to stop container", t)
        }
    }

    override fun onMessage(partialMessage: ByteBuffer, last: Boolean) {
        val data = ByteArray(partialMessage.remaining())
        partialMessage.get(data)
        onMessageCallback?.invoke(data)
    }
}
