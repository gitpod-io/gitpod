// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.client.ClientProjectSession
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import io.gitpod.gitpodprotocol.api.entities.RemoteTrackMessage
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch

class GitpodClientProjectSessionTracker(
        private val session: ClientProjectSession
) {

    private val manager = service<GitpodManager>()
    init {
        GlobalScope.launch {
            val info = manager.pendingInfo.await()
            val event = RemoteTrackMessage().apply {
                event = "jb_session"
                properties = mapOf(
                        "sessionId" to session.clientId.value,
                        "instanceId" to info.infoResponse.instanceId,
                        "workspaceId" to info.infoResponse.workspaceId,
                        "appName" to ApplicationInfo.getInstance().versionName,
                        "appVersion" to ApplicationInfo.getInstance().fullVersion,
                        "timestamp" to System.currentTimeMillis()
                )
            }
            if (manager.devMode) {
                thisLogger().warn("gitpod: $event")
            } else {
                manager.client.server.trackEvent(event)
            }
        }
    }
}