// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.deploy.DiagnosticInfoCollector
import java.nio.file.Path
import java.util.concurrent.CompletableFuture
import org.slf4j.Logger


class GitpodLogger(private val logger:Logger) : DiagnosticInfoCollector {
    override fun collectAdditionalDiagnostics(p0: Path): CompletableFuture<*> {
        logger.info(">>>>>> $p0")
        TODO("Not yet implemented")
    }
}
