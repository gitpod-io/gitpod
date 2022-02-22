// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.components.service
import com.intellij.remoteDev.customization.GatewayBranding
import io.gitpod.jetbrains.remote.icons.GitpodIcons
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import javax.swing.Icon

class GitpodBranding : GatewayBranding {

    val manager = service<GitpodManager>()

    /*
       TODO(ak) GITPOD_WORSPACE_ID is a subject to change
        ideally we should not rely on it, but here `getName` is sync
        alternatively we could precompute another env var based on supervisor info endpoint
        before starting backend
    */
    private var name = System.getenv("GITPOD_WORKSPACE_ID") ?: "Gitpod"
    init {
        GlobalScope.launch {
            val info = manager.pendingInfo.await()
            name = info.workspaceId
        }
    }

    override fun getIcon(): Icon {
        return GitpodIcons.Logo
    }

    override fun getName(): String {
        return name
    }

}