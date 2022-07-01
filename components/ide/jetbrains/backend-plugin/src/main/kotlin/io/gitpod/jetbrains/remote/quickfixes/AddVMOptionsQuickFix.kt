// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.quickfixes

import com.intellij.codeInspection.LocalQuickFix
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement
import com.intellij.psi.codeStyle.CodeStyleManager
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.util.IncorrectOperationException
import io.gitpod.jetbrains.remote.utils.GitpodConfig.YamlKey
import io.gitpod.jetbrains.remote.utils.GitpodConfig.gitpodYamlFile
import org.jetbrains.yaml.YAMLElementGenerator
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLKeyValue

class AddVMOptionsQuickFix(private val productName: String, private val xmxValueMiB: Long) : LocalQuickFix {

    override fun getName() = "Add -Xmx${xmxValueMiB}m to $gitpodYamlFile"

    override fun getFamilyName() = name

    override fun applyFix(project: Project, descriptor: ProblemDescriptor) {
        val psiFile = descriptor.psiElement as? YAMLFile ?: return
        val document = psiFile.viewProvider.document ?: return
        val generator = YAMLElementGenerator.getInstance(project)
        val jetbrainsKeyValue = findOrCreateYamlKeyValue(psiFile, YamlKey.jetbrains, "", generator) ?: return
        val productKeyValue = findOrCreateYamlKeyValue(jetbrainsKeyValue, productName, "", generator) ?: return
        findOrCreateYamlKeyValue(productKeyValue, YamlKey.vmOptions, "-Xmx${xmxValueMiB}m", generator)
        PsiDocumentManager.getInstance(project).doPostponedOperationsAndUnblockDocument(document)
        try {
            CodeStyleManager.getInstance(project).reformat(jetbrainsKeyValue)
        } catch (e: IncorrectOperationException) {
            thisLogger().warn("AddVMOptionsQuickFix reformat failed", e)
        }
    }

    private fun findOrCreateYamlKeyValue(
        parent: PsiElement,
        keyText: String,
        valueText: String,
        generator: YAMLElementGenerator
    ): PsiElement? {
        var element = findElementByYamlKeyText(parent, keyText)
        return if (element == null) {
            element = generator.createYamlKeyValue(keyText, valueText)
            parent.add(generator.createEol())
            parent.add(element) ?: return null
        } else {
            element
        }
    }

    private fun findElementByYamlKeyText(rootElement: PsiElement, keyText: String): PsiElement? {
        return PsiTreeUtil.collectElements(rootElement) {
            it is YAMLKeyValue && it.keyText == keyText
        }.firstOrNull()
    }
}