// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.Disposable

interface GitpodGlobalPortForwardingService {
    fun monitorPortsOfPid(disposable: Disposable, pid: Long)
}
