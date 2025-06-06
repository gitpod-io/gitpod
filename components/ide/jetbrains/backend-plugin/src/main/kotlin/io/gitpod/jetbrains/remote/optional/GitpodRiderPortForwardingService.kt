// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.optional

import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.threading.coroutines.launch
import io.gitpod.jetbrains.remote.AbstractGitpodPortForwardingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow

@Suppress("UnstableApiUsage")
class GitpodRiderPortForwardingService : AbstractGitpodPortForwardingService() {
    override fun runJob(lifetime: Lifetime, block: suspend CoroutineScope.() -> Unit) = lifetime.launch { block() }

    override suspend fun <T> applyThrottling(flow: Flow<T>): Flow<T> = flow
}
