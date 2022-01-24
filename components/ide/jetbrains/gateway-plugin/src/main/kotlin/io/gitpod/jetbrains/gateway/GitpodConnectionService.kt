// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.extensions.PluginId
import com.intellij.remoteDev.util.onTerminationOrNow
import com.intellij.util.ExceptionUtil
import com.intellij.util.io.DigestUtil
import com.jetbrains.rd.util.concurrentMapOf
import com.jetbrains.rd.util.lifetime.Lifetime
import io.gitpod.gitpodprotocol.api.GitpodServerLauncher
import io.gitpod.jetbrains.auth.GitpodAuthService
import kotlinx.coroutines.*
import kotlinx.coroutines.future.await
import org.eclipse.jetty.websocket.api.UpgradeException
import java.nio.charset.StandardCharsets

@Service
class GitpodConnectionService {

    private val clients = concurrentMapOf<String, GatewayGitpodClient>();

    fun obtainClient(gitpodHost: String): GatewayGitpodClient {
        return clients.getOrPut(gitpodHost) {
            val lifetime = Lifetime.Eternal.createNested()
            val client = GatewayGitpodClient(lifetime, gitpodHost)
            val launcher = GitpodServerLauncher.create(client)
            val job = GlobalScope.launch {
                var accessToken = GitpodAuthService.getAccessToken(gitpodHost)
                val authorize = suspend {
                    ensureActive()
                    accessToken = GitpodAuthService.authorize(gitpodHost)
                }
                if (accessToken == null) {
                    authorize();
                }

                val plugin = PluginManagerCore.getPlugin(PluginId.getId("io.gitpod.jetbrains.gateway"))!!
                val connect = suspend {
                    ensureActive()
                    val originalClassLoader = Thread.currentThread().contextClassLoader
                    val connection = try {
                        // see https://intellij-support.jetbrains.com/hc/en-us/community/posts/360003146180/comments/360000376240
                        Thread.currentThread().contextClassLoader = GitpodConnectionProvider::class.java.classLoader
                        launcher.listen(
                            "wss://${gitpodHost}/api/v1",
                            "https://${gitpodHost}/",
                            plugin.pluginId.idString,
                            plugin.version,
                            accessToken
                        )
                    } catch (t: Throwable) {
                        val badUpgrade = ExceptionUtil.findCause(t, UpgradeException::class.java)
                        if (badUpgrade?.responseStatusCode == 401 || badUpgrade?.responseStatusCode == 403) {
                            throw InvalidTokenException("failed web socket handshake (${badUpgrade.responseStatusCode})")
                        }
                        throw t
                    } finally {
                        Thread.currentThread().contextClassLoader = originalClassLoader;
                    }
                    val tokenHash = DigestUtil.sha256Hex(accessToken!!.toByteArray(StandardCharsets.UTF_8))
                    val tokenScopes = client.server.getGitpodTokenScopes(tokenHash).await()
                    for (scope in GitpodAuthService.scopes) {
                        if (!tokenScopes.contains(scope)) {
                            connection.cancel(false)
                            throw InvalidTokenException("$scope scope is not granted")
                        }
                    }
                    connection
                }

                val minReconnectionDelay = 2 * 1000L
                val maxReconnectionDelay = 30 * 1000L
                val reconnectionDelayGrowFactor = 1.5;
                var reconnectionDelay = minReconnectionDelay;
                while (isActive) {
                    try {
                        val connection = try {
                            connect()
                        } catch (t: Throwable) {
                            val e = ExceptionUtil.findCause(t, InvalidTokenException::class.java) ?: throw t
                            thisLogger().warn("${gitpodHost}: invalid token, authorizing again and reconnecting:", e)
                            authorize()
                            connect()
                        }
                        reconnectionDelay = minReconnectionDelay
                        thisLogger().info("${gitpodHost}: connected")
                        val reason = connection.await()
                        if (isActive) {
                            thisLogger().warn("${gitpodHost}: connection closed, reconnecting after $reconnectionDelay milliseconds: $reason")
                        } else {
                            thisLogger().info("${gitpodHost}: connection permanently closed: $reason")
                        }
                    } catch (t: Throwable) {
                        if (isActive) {
                            thisLogger().warn(
                                "${gitpodHost}: failed to connect, trying again after $reconnectionDelay milliseconds:",
                                t
                            )
                        } else {
                            thisLogger().error("${gitpodHost}: connection permanently closed:", t)
                        }
                    }
                    delay(reconnectionDelay)
                    reconnectionDelay = (reconnectionDelay * reconnectionDelayGrowFactor).toLong()
                    if (reconnectionDelay > maxReconnectionDelay) {
                        reconnectionDelay = maxReconnectionDelay
                    }
                }
            }
            lifetime.onTerminationOrNow {
                clients.remove(gitpodHost)
                job.cancel()
            }
            return@getOrPut client
        }
    }

    private class InvalidTokenException(message: String) : Exception(message)

}