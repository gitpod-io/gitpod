// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.utils

/**
 * Constants and util functions for Gitpod config spec
 */
object GitpodConfig {

    // FIXME: get from env var
    const val defaultXmxMiB = 2048L
    const val gitpodYamlFile = ".gitpod.yml"

    object YamlKey {
        const val jetbrains = "jetbrains"
        const val vmOptions = "vmoptions"
    }

    /**
     * map JetBrains IDE productCode to YAML key for .gitpod.yml
     */
    fun getJetBrainsProductName(productCode: String): String? {
        return when (productCode) {
            "IC" -> "intellij"
            "IU" -> "intellij"
            "PS" -> "phpstorm"
            "PY" -> "pycharm"
            "GO" -> "goland"
            else -> null
        }
    }
}
