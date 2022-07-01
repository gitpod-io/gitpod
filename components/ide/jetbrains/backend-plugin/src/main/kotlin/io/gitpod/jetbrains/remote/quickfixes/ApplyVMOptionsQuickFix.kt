// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.quickfixes

import com.intellij.codeInspection.LocalQuickFix
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.diagnostic.VMOptions
import com.intellij.openapi.project.Project

class ApplyVMOptionsQuickFix(private val quickFixName: String, private val xmxValueMiB: Long) : LocalQuickFix {

    override fun getName() = quickFixName

    override fun getFamilyName() = name

    override fun applyFix(project: Project, descriptor: ProblemDescriptor) {
        if (VMOptions.canWriteOptions()) {
            VMOptions.setOption(VMOptions.MemoryKind.HEAP, xmxValueMiB.toInt())
        }
    }
}