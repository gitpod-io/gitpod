// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable

import com.intellij.openapi.Disposable
import io.gitpod.jetbrains.remote.GitpodGlobalPortForwardingService

class GitpodGlobalPortForwardingServiceImpl : GitpodGlobalPortForwardingService {
    override fun monitorPortsOfPid(disposable: Disposable, pid: Long) = Unit
}
