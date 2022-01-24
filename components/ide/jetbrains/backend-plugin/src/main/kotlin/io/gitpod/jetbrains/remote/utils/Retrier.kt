// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.utils

import com.intellij.openapi.diagnostic.thisLogger

object Retrier {
    @Suppress("TooGenericExceptionCaught")
    suspend fun <T> retry(n: Int, fn: suspend () -> T): T {
        require(n >= 0)
        var i = 0
        while (true) {
            try {
                return fn()
            } catch (e: Exception) {
                if (i++ < n) {
                    thisLogger().error(e)
                } else {
                    throw e
                }
            }
        }
    }
}
