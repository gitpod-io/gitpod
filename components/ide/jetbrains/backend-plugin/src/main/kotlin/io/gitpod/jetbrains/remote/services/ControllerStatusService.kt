// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.services

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.PropertyNamingStrategies
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.gitpod.jetbrains.remote.utils.Retrier.retry
import org.jetbrains.ide.BuiltInServerManager
import java.io.IOException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

object ControllerStatusService {
    private val cwmToken = System.getenv("CWM_HOST_STATUS_OVER_HTTP_TOKEN")
    private val httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.ALWAYS)
        .connectTimeout(Duration.ofSeconds(2))
        .build()
    private val jacksonMapper = jacksonObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

    data class ControllerStatus(val connected: Boolean, val secondsSinceLastActivity: Int)

    /**
     * @throws IOException
     */
    suspend fun fetch(): ControllerStatus =
        @Suppress("MagicNumber")
        retry(3) {
            val port = BuiltInServerManager.getInstance().waitForStart().port
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:$port/codeWithMe/unattendedHostStatus?token=$cwmToken"))
                .header("Content-Type", "application/json")
                .GET()
                .build()
            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() !== 200) {
                throw IOException("gitpod: failed to retrieve controller status: ${response.statusCode()}")
            }
            val status = with(jacksonMapper) {
                propertyNamingStrategy = PropertyNamingStrategies.LowerCamelCaseStrategy()
                readValue(response.body(), ControllerStatusResponse::class.java)
            }

            if (status.projects.isNullOrEmpty()) {
                return@retry ControllerStatus(false, 0)
            }

            return@retry ControllerStatus(
                status.projects[0].controllerConnected,
                status.projects[0].secondsSinceLastControllerActivity
            )
        }

    data class Project(
        val controllerConnected: Boolean,
        val secondsSinceLastControllerActivity: Int
    )

    private data class ControllerStatusResponse(
        val projects: List<Project>?
    )

}
