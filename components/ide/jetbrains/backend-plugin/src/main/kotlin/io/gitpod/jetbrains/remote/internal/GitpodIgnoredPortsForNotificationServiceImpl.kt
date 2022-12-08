// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.internal

import com.intellij.idea.getServerFutureAsync
import io.gitpod.jetbrains.remote.GitpodIgnoredPortsForNotificationService
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.jetbrains.ide.BuiltInServerManager

@Suppress("OPT_IN_USAGE")
class GitpodIgnoredPortsForNotificationServiceImpl : GitpodIgnoredPortsForNotificationService {
    private val ignoredPortsForNotification = mutableSetOf(5990)

    init {
        GlobalScope.launch {
            BuiltInServerManager.getInstance().waitForStart().port.let { ignorePort(it) }
            getServerFutureAsync().await()?.port?.let { ignorePort(it) }
        }
    }

    override fun ignorePort(portNumber: Int) {
        ignoredPortsForNotification.add(portNumber)
    }

    override fun getIgnoredPorts(): Set<Int> {
        return ignoredPortsForNotification.toSet()
    }
}
