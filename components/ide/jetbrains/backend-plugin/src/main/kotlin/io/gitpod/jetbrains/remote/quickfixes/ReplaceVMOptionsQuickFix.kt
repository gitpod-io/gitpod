// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.quickfixes

import com.intellij.codeInspection.LocalQuickFix
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.openapi.project.Project
import io.gitpod.jetbrains.remote.utils.GitpodConfig.YamlKey
import org.jetbrains.yaml.YAMLElementGenerator
import org.jetbrains.yaml.psi.YAMLKeyValue

class ReplaceVMOptionsQuickFix(private val xmxValueMiB: Long) : LocalQuickFix {

    override fun getName() = "Set Xmx to $xmxValueMiB MiB"

    override fun getFamilyName() = name

    override fun applyFix(project: Project, descriptor: ProblemDescriptor) {
        val vmOptionsKeyValue = descriptor.psiElement as? YAMLKeyValue ?: return
        if (vmOptionsKeyValue.keyText != YamlKey.vmOptions) return
        val vmOptions = vmOptionsKeyValue.valueText.trim().split("\\s".toRegex())
        val xmxUpdated = "-Xmx${xmxValueMiB}m"
        val xmxOptions = vmOptions
            .filter { it.startsWith("-Xmx") }
            .map { xmxUpdated }
            .ifEmpty { listOf(xmxUpdated) }
        val nonXmxOptions = vmOptions
            .filter { !it.startsWith("-Xmx") }
        val newVmOptions = (xmxOptions + nonXmxOptions).toSortedSet().joinToString(" ")
        val generator = YAMLElementGenerator.getInstance(project)
        val psiElementUpdated = generator.createYamlKeyValue(YamlKey.vmOptions, newVmOptions)
        vmOptionsKeyValue.replace(psiElementUpdated)
    }
}