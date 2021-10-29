// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.ide.jetbrains.backend.services

import com.intellij.openapi.diagnostic.logger
import io.gitpod.ide.jetbrains.backend.utils.Retrier.retry
import io.gitpod.supervisor.api.Token.GetTokenRequest
import io.gitpod.supervisor.api.TokenServiceGrpc
import io.grpc.ManagedChannelBuilder
import kotlinx.coroutines.guava.asDeferred

object AuthTokenService {
    private val logger = logger<AuthTokenService>()
    private const val SUPERVISOR_ADDRESS = "localhost:22999"

    @Suppress("MagicNumber")
    suspend fun fetchToken(): String =
        retry(3, logger) {
            val channel = ManagedChannelBuilder
                .forTarget(SUPERVISOR_ADDRESS)
                .usePlaintext()
                .build()

            val request = GetTokenRequest.newBuilder()
                .setHost(System.getenv("GITPOD_HOST").split("//").last())
                .addScope("function:sendHeartBeat")
                .setKind("gitpod")
                .build()

            val response = TokenServiceGrpc
                .newFutureStub(channel)
                .getToken(request)
                .asDeferred()
                .await()

            response.token
        }
}
