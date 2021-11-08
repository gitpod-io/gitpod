// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.ide.jetbrains.backend.services

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonSetter
import com.fasterxml.jackson.annotation.Nulls
import com.intellij.openapi.diagnostic.logger
import io.gitpod.ide.jetbrains.backend.utils.Retrier.retry
import io.ktor.client.HttpClient
import io.ktor.client.features.HttpTimeout
import io.ktor.client.features.json.JacksonSerializer
import io.ktor.client.features.json.JsonFeature
import io.ktor.client.request.get
import java.io.IOException

object ControllerStatusService {
    private val logger = logger<ControllerStatusService>()

    private const val PORT = 63342
    private val cwmToken = System.getenv("CWM_HOST_STATUS_OVER_HTTP_TOKEN")

    private val client: HttpClient by lazy {
        HttpClient {
            install(HttpTimeout) {
                @Suppress("MagicNumber")
                requestTimeoutMillis = 2000
            }
            install(JsonFeature) {
                serializer = JacksonSerializer()
            }
        }
    }

    data class ControllerStatus(val connected: Boolean, val secondsSinceLastActivity: Int)

    /**
     * @throws IOException
     */
    suspend fun fetch(): ControllerStatus =
        @Suppress("MagicNumber")
        retry(3, logger) {
            @Suppress("TooGenericExceptionCaught") // Unsure what exceptions Ktor might throw
            val response: Response = try {
                client.get("http://localhost:$PORT/codeWithMe/unattendedHostStatus?token=$cwmToken")
            } catch (e: Exception) {
                throw IOException("Failed to retrieve controller status.", e)
            }

            if (response.projects.isEmpty()) {
                return@retry ControllerStatus(false, 0)
            }

            return@retry ControllerStatus(
                response.projects[0].controllerConnected,
                response.projects[0].secondsSinceLastControllerActivity
            )
        }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class Response(
        val appPid: Int,
        @JsonSetter(nulls = Nulls.AS_EMPTY)
        val projects: List<Project>
    ) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        data class Project(
            val controllerConnected: Boolean,
            val secondsSinceLastControllerActivity: Int
        )
    }
}
