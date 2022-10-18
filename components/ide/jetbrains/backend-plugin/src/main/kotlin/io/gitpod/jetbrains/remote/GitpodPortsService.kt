// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.diagnostic.thisLogger
import com.jetbrains.rd.util.URI
import org.apache.http.client.utils.URIBuilder
import java.util.Optional
import java.util.regex.Pattern

class GitpodPortsService {
    companion object {
        /** Host used by forwarded ports on JetBrains Client. */
        const val FORWARDED_PORT_HOST = "127.0.0.1"
    }
    private val hostToClientForwardedPortMap: MutableMap<Int, Int> = mutableMapOf()

    fun isForwarded(hostPort: Int): Boolean = hostToClientForwardedPortMap.containsKey(hostPort)

    private fun getForwardedPort(hostPort: Int): Optional<Int> = Optional.ofNullable(hostToClientForwardedPortMap[hostPort])

    fun setForwardedPort(hostPort: Int, clientPort: Int) {
        hostToClientForwardedPortMap[hostPort] = clientPort
    }

    fun removeForwardedPort(hostPort: Int) {
        hostToClientForwardedPortMap.remove(hostPort)
    }

    fun getLocalHostUriFromHostPort(hostPort: Int): URI {
        val optionalForwardedPort = getForwardedPort(hostPort)

        val port = if (optionalForwardedPort.isPresent) {
            optionalForwardedPort.get()
        } else {
            thisLogger().warn(
                    "gitpod: Tried to get the forwarded port of $hostPort, which was not forwarded. " +
                    "Returning $hostPort itself."
            )
            hostPort
        }

        return URIBuilder()
                .setScheme("http")
                .setHost(FORWARDED_PORT_HOST)
                .setPort(port)
                .build()
    }

    interface LocalHostUriMetadata {
        val address: String
        val port: Int
    }

    fun extractLocalHostUriMetaDataForPortMapping(uri: URI): Optional<LocalHostUriMetadata> {
        if (uri.scheme != "http" && uri.scheme != "https") return Optional.empty()

        val localhostMatch = Pattern.compile("^(localhost|127(?:\\.[0-9]+){0,2}\\.[0-9]+|0+(?:\\.0+){0,2}\\.0+|\\[(?:0*:)*?:?0*1?])(?::(\\d+))?\$").matcher(uri.authority)

        if (!localhostMatch.find()) return Optional.empty()

        var address = localhostMatch.group(1)
        if (address.startsWith('[') && address.endsWith(']')) {
            address = address.substring(1, address.length - 2)
        }

        var port = 443
        try {
            port = localhostMatch.group(2).toInt()
        } catch (throwable: Throwable){
            if (uri.scheme == "http") port = 80
        }

        return Optional.of(object: LocalHostUriMetadata {
             override val address = address
             override val port = port
        })
    }
}
