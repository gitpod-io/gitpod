// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.ide.ApplicationInitializedListener
import com.intellij.openapi.components.service
import io.gitpod.jetbrains.remote.services.HeartbeatService
import kotlinx.coroutines.CoroutineScope

class GitpodApplicationListener: ApplicationInitializedListener {
    private val manager = service<GitpodManager>()
    private val heartbeatService = service<HeartbeatService>()
    private val ignoredPortsService = service<GitpodIgnoredPortsForNotificationService>()
    private val portForwardingService = service<GitpodPortForwardingService>()
    override suspend fun execute(asyncScope: CoroutineScope) {
    }
}
