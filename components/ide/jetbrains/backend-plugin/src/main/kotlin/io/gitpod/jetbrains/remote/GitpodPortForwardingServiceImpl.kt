// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.threading.coroutines.launch
import io.gitpod.jetbrains.remote.AbstractGitpodPortForwardingService
import kotlinx.coroutines.CoroutineScope

@Suppress("UnstableApiUsage")
class GitpodPortForwardingServiceImpl : AbstractGitpodPortForwardingService() {
    override fun runJob(lifetime: Lifetime, block: suspend CoroutineScope.() -> Unit) = lifetime.launch { block() }
}
