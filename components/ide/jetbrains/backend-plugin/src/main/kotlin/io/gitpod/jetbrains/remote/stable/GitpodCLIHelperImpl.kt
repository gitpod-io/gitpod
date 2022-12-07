// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable

import com.intellij.ide.CommandLineProcessor
import io.gitpod.jetbrains.remote.GitpodCLIHelper
import java.nio.file.Path

@Suppress("UnstableApiUsage")
class GitpodCLIHelperImpl : GitpodCLIHelper  {
    override suspend fun open(file :Path, shouldWait: Boolean) {
        CommandLineProcessor.doOpenFileOrProject(file, shouldWait).future.get()
    }
}
