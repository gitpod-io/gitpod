// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.ide.jetbrains.backend.services

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.intellij.openapi.diagnostic.logger
import io.ktor.client.HttpClient
import io.ktor.client.features.HttpTimeout
import io.ktor.client.features.json.JsonFeature
import io.ktor.client.request.get
import io.ktor.client.features.json.JacksonSerializer

class ControllerStatusProvider {
    private val logger = logger<ControllerStatusProvider>()

    private val client: HttpClient = HttpClient() {
        install(HttpTimeout) {
            @Suppress("MagicNumber")
            requestTimeoutMillis = 2000
        }
        install(JsonFeature) {
            serializer = JacksonSerializer()
        }
    }
    private val cwmToken = System.getenv("CWM_HOST_STATUS_OVER_HTTP_TOKEN")

    suspend fun fetch(): ControllerStatus {
        @Suppress("TooGenericExceptionCaught") // Unsure what exceptions Ktor might throw
        val response: Response = try {
            client.get("http://localhost:$PORT/codeWithMe/unattendedHostStatus?token=$cwmToken")
        } catch (e: Exception) {
            logger.error(e)
            throw ConnectionFailed(cwmToken)
        }

        if (response.projects.isEmpty()) {
            return ControllerStatus(false, 0)
        }

        return ControllerStatus(
            response.projects[0].controllerConnected,
            response.projects[0].secondsSinceLastControllerActivity
        )
    }

    companion object {
        private const val PORT = 63342

        data class ControllerStatus(val connected: Boolean, val secondsSinceLastActivity: Int)

        class ConnectionFailed(token: String) :
            Exception("Couldn't connect to Jetbrains IDE backend at port $PORT with token $token ")

        @JsonIgnoreProperties(ignoreUnknown = true)
        private data class Response(
            val appPid: Int,
            val projects: List<Project>
        ) {
            @JsonIgnoreProperties(ignoreUnknown = true)
            data class Project(
                val controllerConnected: Boolean,
                val secondsSinceLastControllerActivity: Int
            )
        }
    }
}
