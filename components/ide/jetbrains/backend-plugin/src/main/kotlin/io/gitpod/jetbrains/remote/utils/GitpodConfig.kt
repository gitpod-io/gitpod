// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.utils

/**
 * Constants and util functions for Gitpod config spec
 */
object GitpodConfig {

    const val gitpodYamlFile = ".gitpod.yml"
    const val defaultXmxOption = "-Xmx2048m"
    const val gitpodYamlReferenceLink = "https://www.gitpod.io/docs/references/gitpod-yml#jetbrainsproductvmoptions"

    object YamlKey {
        const val jetbrains = "jetbrains"
        const val vmOptions = "vmoptions"
    }

    object YamlTemplate {

        fun buildVMOptions(productName: String, xmxValueMiB: Long): String {
            return """
             |jetbrains:
             |  $productName:
             |    vmoptions: "-Xmx${xmxValueMiB}m"
             """.trimMargin()
        }
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
