// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.utils

import com.jetbrains.rd.util.URI
import java.util.*
import java.util.regex.Pattern

object LocalHostUri {
    interface LocalHostUriMetadata {
        val address: String
        val port: Int
    }

    /** Function ported from https://github.com/gitpod-io/openvscode-server/blob/ce5566276e561303d92bec32a9f58008cddd5270/src/vs/platform/tunnel/common/tunnel.ts#L138 */
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
