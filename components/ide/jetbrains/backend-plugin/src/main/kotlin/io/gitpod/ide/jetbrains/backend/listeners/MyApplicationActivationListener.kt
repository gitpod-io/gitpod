// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.ide.jetbrains.backend.listeners

import com.intellij.openapi.application.ApplicationActivationListener
import com.intellij.openapi.components.service
import com.intellij.openapi.wm.IdeFrame
import io.gitpod.ide.jetbrains.backend.services.HeartbeatService

class MyApplicationActivationListener : ApplicationActivationListener {
    override fun applicationActivated(ideFrame: IdeFrame) {
        service<HeartbeatService>() // Services are not loaded if not referenced
    }
}
