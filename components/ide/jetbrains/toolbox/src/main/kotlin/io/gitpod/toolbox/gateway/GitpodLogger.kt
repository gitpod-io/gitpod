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
