// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.diagnostic.VMOptions
import com.intellij.ide.BrowserUtil
import com.intellij.ide.actions.OpenFileAction
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.util.BuildNumber
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiFileFactory
import com.intellij.psi.PsiManager
import com.intellij.util.application
import io.gitpod.jetbrains.remote.utils.GitpodConfig
import io.gitpod.jetbrains.remote.utils.GitpodConfig.YamlKey.jetbrains
import io.gitpod.jetbrains.remote.utils.GitpodConfig.YamlKey.vmOptions
import io.gitpod.jetbrains.remote.utils.GitpodConfig.defaultXmxOption
import io.gitpod.jetbrains.remote.utils.GitpodConfig.gitpodYamlFile
import io.gitpod.jetbrains.remote.utils.GitpodConfig.gitpodYamlReferenceLink
import org.jetbrains.yaml.YAMLFileType
import org.jetbrains.yaml.YAMLUtil
import org.jetbrains.yaml.psi.YAMLFile
import org.jetbrains.yaml.psi.YAMLKeyValue
import java.nio.file.Paths

class GitpodStartupActivity : StartupActivity.Background {

    override fun runActivity(project: Project) {
        application.invokeLater { checkMemoryOption(project) }
    }

    private fun checkMemoryOption(project: Project) {
        val productCode = BuildNumber.currentVersion().productCode
        val productName = GitpodConfig.getJetBrainsProductName(productCode) ?: return
        // it's ok for .gitpod.yml to not exist
        var vmOptions = emptyList<String>()
        getGitpodYamlVirtualFile(project)?.let {
            val vmOptionsKeyValue = getGitpodYamlVMOptionsPsiElement(project, it, productName)
            vmOptions = vmOptionsKeyValue?.valueText?.split("\\s".toRegex()) ?: emptyList()
        }
        // if there is no -Xmx option from .gitpod.yml, compare runtime maxHeapSize with default value
        var xmxVmOptions = vmOptions.filter { it.startsWith("-Xmx") }
        if (xmxVmOptions.isEmpty()) {
            xmxVmOptions = listOf(defaultXmxOption)
        }
        // the rightmost -Xmx option is the one to take effect (after deduplication)
        val finalXmx = xmxVmOptions.last()
        // shift right 20 (xmxInBytes >> 20) to convert to MiB
        val finalXmxValueInMiB = VMOptions.parseMemoryOption(finalXmx.substringAfter("-Xmx")).shr(20)
        val runtimeXmxValueInMiB = Runtime.getRuntime().maxMemory().shr(20)
        if (finalXmxValueInMiB != runtimeXmxValueInMiB) {
            showEditVMOptionsNotification(project, runtimeXmxValueInMiB, finalXmxValueInMiB, productName)
        }
    }

    private fun getGitpodYamlVirtualFile(project: Project): VirtualFile? {
        val basePath = project.basePath ?: return null
        return VfsUtil.findFile(Paths.get(basePath, gitpodYamlFile), true)
    }

    private fun getGitpodYamlVMOptionsPsiElement(
        project: Project,
        virtualFile: VirtualFile,
        productName: String
    ): YAMLKeyValue? {
        val psiFile = PsiManager.getInstance(project).findFile(virtualFile) as? YAMLFile ?: return null
        return YAMLUtil.getQualifiedKeyInFile(psiFile, jetbrains, productName, vmOptions)
    }

    private fun showEditVMOptionsNotification(project: Project, runtimeXmxMiB: Long, configXmxMiB: Long, productName: String) {
        val notificationGroup = NotificationGroupManager.getInstance().getNotificationGroup("Gitpod Notifications")
        val title = "Gitpod memory settings"
        val message = """
            |Current maxHeapSize <code>-Xmx${runtimeXmxMiB}m</code> is not matched to configured <code>-Xmx${configXmxMiB}m</code>.<br/>
            |Set vmoptions in .gitpod.yml
        """.trimMargin()
        val notification = notificationGroup.createNotification(title, message, NotificationType.WARNING)
        // edit or create .gitpod.yaml
        val virtualFile = getGitpodYamlVirtualFile(project)
        val primaryAction = if (virtualFile != null) {
            editGitpodYamlAction(project, virtualFile, productName)
        } else {
            createGitpodYamlAction(project, productName, runtimeXmxMiB)
        }
        notification.addAction(primaryAction)
        // show gitpod.yml reference
        val helpAction = NotificationAction.createSimple("More info") {
            BrowserUtil.browse(gitpodYamlReferenceLink)
        }
        notification.addAction(helpAction)
        notification.notify(project)
    }

    private fun editGitpodYamlAction(project: Project, gitpodYaml: VirtualFile, productName: String): NotificationAction {
        return NotificationAction.createSimple("Edit .gitpod.yml") {
            OpenFileAction.openFile(gitpodYaml, project)
            val vmOptionsKeyValue = getGitpodYamlVMOptionsPsiElement(project, gitpodYaml, productName)
            // navigate caret to "vmoptions" if exist
            vmOptionsKeyValue?.navigate(true)
        }
    }

    private fun createGitpodYamlAction(project: Project, productName: String, runtimeXmxMiB: Long): NotificationAction {
        return NotificationAction.createSimple("Create .gitpod.yml") {
            application.runWriteAction {
                val psiFile = PsiFileFactory.getInstance(project).createFileFromText(
                    gitpodYamlFile,
                    YAMLFileType.YML,
                    GitpodConfig.YamlTemplate.buildVMOptions(productName, runtimeXmxMiB)
                )
                project.basePath?.let { basePath ->
                    LocalFileSystem.getInstance().findFileByPath(basePath)?.let { dir ->
                        PsiManager.getInstance(project).findDirectory(dir)?.add(psiFile)
                        // refresh VFS and open created .gitpod.yml in editor
                        getGitpodYamlVirtualFile(project)?.let { OpenFileAction.openFile(it, project) }
                    }
                }
            }
        }
    }
}
