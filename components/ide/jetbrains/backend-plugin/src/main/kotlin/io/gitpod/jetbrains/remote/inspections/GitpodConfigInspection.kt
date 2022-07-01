// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.inspections

import com.intellij.codeInspection.LocalInspectionTool
import com.intellij.codeInspection.ProblemsHolder
import com.intellij.diagnostic.VMOptions
import com.intellij.openapi.util.BuildNumber
import com.intellij.psi.PsiElementVisitor
import com.intellij.psi.PsiFile
import io.gitpod.jetbrains.remote.quickfixes.AddVMOptionsQuickFix
import io.gitpod.jetbrains.remote.quickfixes.ReplaceVMOptionsQuickFix
import io.gitpod.jetbrains.remote.utils.GitpodConfig.YamlKey
import io.gitpod.jetbrains.remote.utils.GitpodConfig.defaultXmxMiB
import io.gitpod.jetbrains.remote.utils.GitpodConfig.getJetBrainsProductName
import io.gitpod.jetbrains.remote.utils.GitpodConfig.gitpodYamlFile
import org.jetbrains.yaml.YAMLUtil
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLKeyValue

class GitpodConfigInspection : LocalInspectionTool() {

    private val runtimeXmxMiB = Runtime.getRuntime().maxMemory().shr(20)

    override fun buildVisitor(holder: ProblemsHolder, isOnTheFly: Boolean): PsiElementVisitor {
        return object : PsiElementVisitor() {
            override fun visitFile(file: PsiFile) {
                if (file.name != gitpodYamlFile || file !is YAMLFile) return
                val productCode = BuildNumber.currentVersion().productCode
                val productName = getJetBrainsProductName(productCode) ?: return
                val keyValue = YAMLUtil.getQualifiedKeyInFile(file, YamlKey.jetbrains, productName, YamlKey.vmOptions)
                if (keyValue == null) {
                    val description = "IDE's max heap size (-Xmx) is ${runtimeXmxMiB}m, but not configured in $gitpodYamlFile"
                    val quickFix = AddVMOptionsQuickFix(productName, runtimeXmxMiB)
                    holder.registerProblem(file, description, quickFix)
                    return
                }
                val configuredXmxMiB = getUserConfiguredXmxValue(keyValue)
                val quickFix = ReplaceVMOptionsQuickFix(runtimeXmxMiB)
                if (configuredXmxMiB == null && runtimeXmxMiB != defaultXmxMiB) {
                    val description = "IDE's max heap size (-Xmx) is ${runtimeXmxMiB}m, but not configured in $gitpodYamlFile"
                    holder.registerProblem(keyValue, description, quickFix)
                } else if (configuredXmxMiB != null && runtimeXmxMiB != configuredXmxMiB) {
                    val description = "IDE's max heap size (-Xmx) is ${runtimeXmxMiB}m, but -Xmx${configuredXmxMiB}m configured in $gitpodYamlFile"
                    holder.registerProblem(keyValue, description, quickFix)
                }
            }
        }
    }

    private fun getUserConfiguredXmxValue(vmOptionsKeyValue: YAMLKeyValue): Long? {
        val vmOptions = vmOptionsKeyValue.valueText.trim().split("\\s".toRegex())
        // the rightmost option is the one to take effect
        val finalXmx = vmOptions.lastOrNull { it.startsWith("-Xmx") } ?: return null
        val xmxValue = finalXmx.substringAfter("-Xmx")
        return try {
            VMOptions.parseMemoryOption(xmxValue).shr(20)
        } catch (e: IllegalArgumentException) {
            // ignore invalid user configuration
            null
        }
    }
}