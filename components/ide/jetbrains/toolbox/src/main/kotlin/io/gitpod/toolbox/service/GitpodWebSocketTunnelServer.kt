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
import java.net.*
import java.nio.ByteBuffer
import java.util.*
import java.util.concurrent.CopyOnWriteArrayList
import javax.net.ssl.SSLContext
import javax.websocket.*
import javax.websocket.ClientEndpointConfig.Configurator
import javax.websocket.MessageHandler.Partial


class GitpodWebSocketTunnelServer(private val provider: ConnectionInfoProvider) {
    val port: Int get() = serverSocket.localPort
    private val serverSocket = ServerSocket(0) // pass 0 to have the system choose a free port
    private val logPrefix = "tunnel: [${provider.getUniqueID()}]"
    private val clients = CopyOnWriteArrayList<GitpodWebSocketTunnelClient>()

    fun start(): () -> Unit {
        val job = Utils.coroutineScope.launch(Dispatchers.IO) {
            Utils.logger.info("$logPrefix listening on port $port")
            try {
                while (isActive) {
                    try {
                        val clientSocket = serverSocket.accept()
                        val url = provider.getWebsocketTunnelUrl()
                        val ownerToken = provider.getOwnerToken()
                        this.launch(Dispatchers.IO) {
                            handleClientConnection(clientSocket, url, ownerToken)
                        }
                    } catch (t: Throwable) {
                        if (isActive) {
                            Utils.logger.error(t, "$logPrefix failed to accept")
                        }
                    }
                }
            } catch (t: Throwable) {
                if (isActive) {
                    Utils.logger.error(t, "$logPrefix failed to listen")
                }
            } finally {
                Utils.logger.info("$logPrefix stopped")
            }
        }
        return {
            job.cancel()
            serverSocket.close()
            clients.forEach { it.close() }
            clients.clear()
        }
    }

    private fun handleClientConnection(clientSocket: Socket, url: String, ownerToken: String) {
        val socketClient = GitpodWebSocketTunnelClient(logPrefix, clientSocket)
        try {
            val inputStream = clientSocket.getInputStream()
            val outputStream = clientSocket.getOutputStream()

            // Forward data from WebSocket to TCP client
            socketClient.onMessageCallback = { data ->
                outputStream.write(data)
                Utils.logger.trace("$logPrefix received ${data.size} bytes")
            }

            connectToWebSocket(socketClient, url, ownerToken)

            clients.add(socketClient)

            val buffer = ByteArray(1024)
            var read: Int
            while (inputStream.read(buffer).also { read = it } != -1) {
                // Forward data from TCP to WebSocket
                socketClient.sendData(buffer.copyOfRange(0, read))
                Utils.logger.trace("$logPrefix sent $read bytes")
            }
        } catch (t: Throwable) {
            if (t is SocketException && t.message?.contains("Socket closed") == true) {
                return
            }
            Utils.logger.error(t, "$logPrefix failed to pipe")
        } finally {
            clients.remove(socketClient)
            socketClient.close()
        }
    }

    private fun connectToWebSocket(socketClient: GitpodWebSocketTunnelClient, url: String, ownerToken: String) {
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
                Utils.logger.warn("$logPrefix unexpected proxy: $proxy")
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

class GitpodWebSocketTunnelClient(private val logPrefix: String, private val tcpSocket: Socket) : Endpoint(),
    Partial<ByteBuffer> {
    private lateinit var webSocketSession: Session
    var onMessageCallback: ((ByteArray) -> Unit)? = null
    var container: ClientContainer? = null

    override fun onOpen(session: Session, config: EndpointConfig) {
        session.addMessageHandler(this)
        this.webSocketSession = session
    }

    override fun onClose(session: Session, closeReason: CloseReason) {
        Utils.logger.info("$logPrefix closed ($closeReason)")
        this.doClose()
    }

    override fun onError(session: Session?, thr: Throwable?) {
        if (thr != null) {
            Utils.logger.error(thr, "$logPrefix failed")
        } else {
            Utils.logger.error("$logPrefix failed")
        }
        this.doClose()
    }

    private fun doClose() {
        try {
            tcpSocket.close()
        } catch (t: Throwable) {
            Utils.logger.error(t, "$logPrefix failed to close socket")
        }
        try {
            container?.stop()
        } catch (t: Throwable) {
            Utils.logger.error(t, "$logPrefix failed to stop container")
        }
    }

    fun sendData(data: ByteArray) {
        webSocketSession.asyncRemote.sendBinary(ByteBuffer.wrap(data))
    }

    fun close() {
        try {
            webSocketSession.close()
        } catch (t: Throwable) {
            Utils.logger.error(t, "$logPrefix failed to close")
        }
        try {
            container?.stop()
        } catch (t: Throwable) {
            Utils.logger.error(t, "$logPrefix failed to stop container")
        }
    }

    override fun onMessage(partialMessage: ByteBuffer, last: Boolean) {
        val data = ByteArray(partialMessage.remaining())
        partialMessage.get(data)
        onMessageCallback?.invoke(data)
    }
}
