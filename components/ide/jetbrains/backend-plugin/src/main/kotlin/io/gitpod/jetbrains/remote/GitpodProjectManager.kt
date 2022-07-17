// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.ProjectTopics
import com.intellij.analysis.AnalysisScope
import com.intellij.codeInspection.actions.RunInspectionIntention
import com.intellij.codeInspection.ex.InspectionManagerEx
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.module.Module
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.project.DumbService
import com.intellij.openapi.project.ModuleListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.projectRoots.ProjectJdkTable
import com.intellij.openapi.projectRoots.Sdk
import com.intellij.openapi.roots.ModuleRootModificationUtil
import com.intellij.openapi.roots.ProjectRootManager
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.profile.codeInspection.InspectionProfileManager
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiManager
import com.intellij.util.application
import io.gitpod.jetbrains.remote.inspections.GitpodConfigInspection
import io.gitpod.jetbrains.remote.utils.GitpodConfig.gitpodYamlFile
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import org.jetbrains.yaml.psi.YAMLFile
import java.nio.file.Paths
import java.util.concurrent.CompletableFuture


class GitpodProjectManager(
        private val project: Project
) {

    init {
        configureSdks()
    }

    init {
        application.invokeLater {
            try {
                runInspection()
            } catch (ex: Exception) {
                thisLogger().error("Failed to run inspection", ex)
            }
        }
    }

    private fun runInspection() {
        val psiFile = getGitpodYamlPsiFile(project) ?: return
        val profile = InspectionProfileManager.getInstance(project).currentProfile
        val inspectionName = GitpodConfigInspection::class.java.simpleName
        val tool = profile.getInspectionTool(inspectionName, psiFile) ?: return
        val manager = InspectionManagerEx.getInstance(project) as InspectionManagerEx
        val scope = AnalysisScope(psiFile)
        DumbService.getInstance(project).smartInvokeLater {
            RunInspectionIntention.rerunInspection(tool, manager, scope, psiFile)
        }
    }

    private fun getGitpodYamlPsiFile(project: Project): PsiFile? {
        val basePath = project.basePath ?: return null
        val vfile = VfsUtil.findFile(Paths.get(basePath, gitpodYamlFile), true) ?: return null
        return PsiManager.getInstance(project).findFile(vfile) as? YAMLFile ?: return null
    }

    /**
     * It is a workaround for https://youtrack.jetbrains.com/issue/GTW-88
     */
    private fun configureSdks() {
        if (application.isHeadlessEnvironment) {
            return
        }
        val pendingSdk = CompletableFuture<Sdk>()
        application.invokeLaterOnWriteThread {
            application.runWriteAction {
                try {
                    ProjectJdkTable.getInstance().preconfigure()
                    pendingSdk.complete(ProjectJdkTable.getInstance().allJdks.firstOrNull())
                } catch (t: Throwable) {
                    pendingSdk.completeExceptionally(t)
                }
            }
        }
        GlobalScope.launch {
            val sdk = pendingSdk.await() ?: return@launch
            thisLogger().warn("gitpod: '${project.name}' project: SDK detected: $sdk")
            project.messageBus.connect().subscribe(ProjectTopics.MODULES, object : ModuleListener {
                override fun moduleAdded(project: Project, module: Module) {
                    configureSdk(sdk)
                }
            })
            configureSdk(sdk)
        }
    }

    private fun configureSdk(sdk: Sdk) {
        application.invokeLaterOnWriteThread {
            application.runWriteAction {
                val projectRootManager = ProjectRootManager.getInstance(project)
                if (projectRootManager.projectSdk == null) {
                    projectRootManager.projectSdk = sdk
                    thisLogger().warn("gitpod: '${project.name}' project: SDK was auto preconfigured: $sdk")
                }
            }
        }
        for (module in ModuleManager.getInstance(project).modules) {
            ModuleRootModificationUtil.updateModel(module) { m ->
                if (m.sdk == null) {
                    m.sdk = sdk
                    thisLogger().warn("gitpod: '${module.name}' module: SDK was auto preconfigured: $sdk")
                }
            }
        }
    }
}