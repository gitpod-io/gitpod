// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.utils

import org.slf4j.LoggerFactory
import org.slf4j.spi.LocationAwareLogger

object GitpodLogger {
    private val logger: LocationAwareLogger = LoggerFactory.getLogger(javaClass) as LocationAwareLogger
    private val FQCN = GitpodLogger::class.java.name

    private fun formatMessage(msg: String): String {
        return "[gitpod] $msg"
    }

    fun info(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.INFO_INT, formatMessage(message), null, null)
    }

    fun debug(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.DEBUG_INT, formatMessage(message), null, null)
    }

    fun warn(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.WARN_INT, formatMessage(message), null, null)
    }

    fun warn(message: String, throwable: Throwable?) {
        logger.log(null, FQCN, LocationAwareLogger.WARN_INT, formatMessage(message), null, throwable)
    }

    fun error(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.ERROR_INT, formatMessage(message), null, null)
    }

    fun error(message: String, throwable: Throwable?) {
        logger.log(null, FQCN, LocationAwareLogger.ERROR_INT, formatMessage(message), null, throwable)
    }

    fun trace(message: String) {
        logger.log(null, FQCN, LocationAwareLogger.TRACE_INT, formatMessage(message), null, null)
    }
}
