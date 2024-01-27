// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.util

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import io.gitpod.jetbrains.remote.utils.LocalHostUri
import io.gitpod.jetbrains.remote.utils.LocalHostUri.LocalHostUriMetadata
import java.net.URI

class LocalHostUriTest : BasePlatformTestCase() {
    fun testExtractLocalHostUriMetaDataForPortMapping() {
        val urlToMetadataMap = mapOf(
            "https://localhost:80" to object: LocalHostUriMetadata {
                override val address = "localhost"
                override val port = 80
            },
            "https://localhost" to object: LocalHostUriMetadata {
                override val address = "localhost"
                override val port = 443
            },
            "http://localhost:12354" to object: LocalHostUriMetadata {
                override val address = "localhost"
                override val port = 12354
            },
            "https://127.0.0.1:3000" to object: LocalHostUriMetadata {
                override val address = "127.0.0.1"
                override val port = 3000
            },
            "http://127.0.0.1:5000" to object: LocalHostUriMetadata {
                override val address = "127.0.0.1"
                override val port = 5000
            },
            "http://[::1]:8080" to object: LocalHostUriMetadata {
                override val address = "::"
                override val port = 8080
            },
        )

        urlToMetadataMap.forEach { (url, expected) ->
            val uri = URI.create(url)
            val actualLocalHostUriMetadataOptional = LocalHostUri.extractLocalHostUriMetaDataForPortMapping(uri)
            val actual = actualLocalHostUriMetadataOptional.get()

            assertEquals(expected.address, actual.address)
            assertEquals(expected.port, actual.port)
        }

        val urlsThatShouldReturnEmpty = listOf(
            "https://localhost:123b",
            "http://192.168.0.1:4000",
            "https://example.com?cb=localhost",
            "https://example.com?cb=http://localhost",
            "https://example.com?cb=https://localhost:8080",
            "https://example.com?cb=https://127.0.0.1:8080"
        )

        urlsThatShouldReturnEmpty.forEach { url ->
            val uri = URI.create(url)
            val localHostUriMetaDataForPort = LocalHostUri.extractLocalHostUriMetaDataForPortMapping(uri)

            assertTrue(localHostUriMetaDataForPort.isEmpty)
        }
    }
}
