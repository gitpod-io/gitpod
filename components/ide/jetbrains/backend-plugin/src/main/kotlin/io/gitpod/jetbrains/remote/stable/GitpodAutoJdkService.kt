// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable

import com.intellij.ProjectTopics
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.module.Module
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.project.ModuleListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.projectRoots.ProjectJdkTable
import com.intellij.openapi.projectRoots.Sdk
import com.intellij.openapi.projectRoots.SdkType
import com.intellij.openapi.projectRoots.impl.JavaHomeFinder
import com.intellij.openapi.projectRoots.impl.SdkConfigurationUtil
import com.intellij.openapi.roots.ModuleRootModificationUtil
import com.intellij.openapi.roots.ProjectRootManager
import com.intellij.openapi.util.registry.Registry
import com.intellij.util.application
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import java.util.concurrent.CompletableFuture

@Suppress("UnstableApiUsage", "OPT_IN_USAGE")
class GitpodAutoJdkService(
        private val project: Project
) {

    init {
        configureSdks()
    }

    /**
     * It is a workaround for https://youtrack.jetbrains.com/issue/GTW-88
     */
    private fun configureSdks() {
        if (application.isHeadlessEnvironment || Registry.get("gitpod.autoJdk.disabled").asBoolean()) {
            return
        }
        val pendingSdk = CompletableFuture<Sdk>()
        application.invokeLaterOnWriteThread {
            application.runWriteAction {
                try {
                    val jdkTable = ProjectJdkTable.getInstance()
                    jdkTable.preconfigure()
                    val preconfiguredJdk = ProjectRootManager.getInstance(project).projectSdk
                    val preferredJdkHomePath = JavaHomeFinder.getFinder().findExistingJdks().firstOrNull()
                    pendingSdk.complete(
                            when {
                                preconfiguredJdk != null -> preconfiguredJdk
                                preferredJdkHomePath != null ->
                                    jdkTable.allJdks.find { sdk -> sdk.homePath == preferredJdkHomePath }
                                            ?: SdkConfigurationUtil.createAndAddSDK(
                                                    preferredJdkHomePath,
                                                    SdkType.findByName(jdkTable.defaultSdkType.name)!!
                                            )

                                else -> jdkTable.allJdks.firstOrNull()
                            }
                    )
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
