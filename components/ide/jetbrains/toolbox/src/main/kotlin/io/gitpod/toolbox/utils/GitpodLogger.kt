// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.utils

import com.jetbrains.toolbox.api.core.diagnostics.Logger
import org.slf4j.LoggerFactory
import org.slf4j.spi.LocationAwareLogger
import java.util.function.Supplier

object GitpodLogger: Logger {
    private val logger: LocationAwareLogger = LoggerFactory.getLogger(javaClass) as LocationAwareLogger
    private val FQCN = GitpodLogger::class.java.name

    private fun formatMessage(msg: String): String {
        return "[gitpod] $msg"
    }

    override fun error(exception: Throwable, message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.ERROR_INT, formatMessage(message.get()), null, exception)
    }

    override fun error(exception: Throwable, message: String) {
        logger.log(null, FQCN, LocationAwareLogger.ERROR_INT, formatMessage(message), null, exception)
    }

    override fun error(message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.ERROR_INT, formatMessage(message.get()), null, null)
    }

    override fun error(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.ERROR_INT, formatMessage(message), null, null)
    }

    override fun warn(exception: Throwable, message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.WARN_INT, formatMessage(message.get()), null, exception)
    }

    override fun warn(exception: Throwable, message: String) {
        logger.log(null, FQCN, LocationAwareLogger.WARN_INT, formatMessage(message), null, exception)
    }

    override fun warn(message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.WARN_INT, formatMessage(message.get()), null, null)
    }

    override fun warn(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.WARN_INT, formatMessage(message), null, null)
    }

    override fun debug(exception: Throwable, message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.DEBUG_INT, formatMessage(message.get()), null, exception)
    }

    override fun debug(exception: Throwable, message: String) {
        logger.log(null, FQCN, LocationAwareLogger.DEBUG_INT, formatMessage(message), null, exception)
    }

    override fun debug(message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.DEBUG_INT, formatMessage(message.get()), null, null)
    }

    override fun debug(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.DEBUG_INT, formatMessage(message), null, null)
    }

    override fun info(exception: Throwable, message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.INFO_INT, formatMessage(message.get()), null, exception)
    }

    override fun info(exception: Throwable, message: String) {
        logger.log(null, FQCN, LocationAwareLogger.INFO_INT, formatMessage(message), null, exception)
    }

    override fun info(message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.INFO_INT, formatMessage(message.get()), null, null)
    }

    override fun info(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.INFO_INT, formatMessage(message), null, null)
    }

    override fun trace(exception: Throwable, message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.TRACE_INT, formatMessage(message.get()), null, exception)
    }

    override fun trace(exception: Throwable, message: String) {
        logger.log(null, FQCN, LocationAwareLogger.TRACE_INT, formatMessage(message), null, exception)
    }

    override fun trace(message: Supplier<String>) {
        logger.log(null, FQCN, LocationAwareLogger.TRACE_INT, formatMessage(message.get()), null, null)
    }

    override fun trace(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.TRACE_INT, formatMessage(message), null, null)
    }

}
