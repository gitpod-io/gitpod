// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.services

import io.gitpod.jetbrains.remote.utils.Retrier.retry
import io.gitpod.supervisor.api.Info.WorkspaceInfoRequest
import io.gitpod.supervisor.api.InfoServiceGrpc
import io.gitpod.supervisor.api.Token
import io.gitpod.supervisor.api.Token.GetTokenRequest
import io.gitpod.supervisor.api.TokenServiceGrpc
import io.grpc.ManagedChannelBuilder
import kotlinx.coroutines.guava.asDeferred

object SupervisorInfoService {
    private const val SUPERVISOR_ADDRESS = "localhost:22999"

    // there should be only one channel per an application to avoid memory leak
    val channel = ManagedChannelBuilder.forTarget(SUPERVISOR_ADDRESS).usePlaintext().build()

    data class Result(
        val infoResponse: io.gitpod.supervisor.api.Info.WorkspaceInfoResponse,
        val tokenResponse: Token.GetTokenResponse
    )

    @Suppress("MagicNumber")
    suspend fun fetch(): Result =
        retry(3) {
            // TODO(ak) retry forever only on network issues, otherwise propagate error
            val infoResponse = InfoServiceGrpc
                .newFutureStub(channel)
                .workspaceInfo(WorkspaceInfoRequest.newBuilder().build())
                .asDeferred()
                .await()

            val request = GetTokenRequest.newBuilder()
                .setHost(infoResponse.gitpodApi.host)
                .addScope("function:sendHeartBeat")
                    .addScope("function:trackEvent")
                .setKind("gitpod")
                .build()

            val tokenResponse = TokenServiceGrpc
                .newFutureStub(channel)
                .getToken(request)
                .asDeferred()
                .await()

            Result(infoResponse, tokenResponse)
        }
}
