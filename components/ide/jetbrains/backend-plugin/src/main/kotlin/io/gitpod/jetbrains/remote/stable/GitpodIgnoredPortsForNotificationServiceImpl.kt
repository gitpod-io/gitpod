// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable

import com.intellij.idea.StartupUtil
import io.gitpod.jetbrains.remote.GitpodIgnoredPortsForNotificationService
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.future.await
import org.jetbrains.ide.BuiltInServerManager

@Suppress("OPT_IN_USAGE")
class GitpodIgnoredPortsForNotificationServiceImpl : GitpodIgnoredPortsForNotificationService {
    private val ignoredPortsForNotification = mutableSetOf(5990)

    init {
        GlobalScope.launch {
            BuiltInServerManager.getInstance().waitForStart().port.let { ignorePort(it) }
            StartupUtil.getServerFuture().await().port?.let { ignorePort(it) }
        }
    }

    override fun ignorePort(portNumber: Int) {
        ignoredPortsForNotification.add(portNumber)
    }

    override fun getIgnoredPorts(): Set<Int> {
        return ignoredPortsForNotification.toSet()
    }
}
