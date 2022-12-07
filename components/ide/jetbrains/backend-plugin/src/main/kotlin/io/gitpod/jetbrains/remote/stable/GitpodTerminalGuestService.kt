// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable
import com.intellij.openapi.client.ClientProjectSession
import io.gitpod.jetbrains.remote.GitpodTerminalService

@Suppress("UnstableApiUsage")
class GitpodTerminalGuestService(session: ClientProjectSession) {
    init { GitpodTerminalService(session.project) }
}
