// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.jetbrains.ide.model.uiautomation.BeControl
import com.jetbrains.rd.ui.bedsl.dsl.*
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.reactive.Property
import com.jetbrains.rdserver.diagnostics.BackendDiagnosticsService
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.MetricControlProvider
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressBar
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressRow

class GitpodMetricControlProvider : MetricControlProvider {
    override val id: String = "gitpodMetricsControl"
    override fun getControl(lifetime: Lifetime): BeControl {
        val backendDiagnosticsService = BackendDiagnosticsService.Companion.getInstance()

        return verticalGrid {
            row {
                horizontalGrid {
                    column {
                        label("Workspace")
                    }
                }
            }
            createWorkspaceHeaderRow(this, backendDiagnosticsService, lifetime)
            row {
                verticalGrid {
                    createCpuControl(this, backendDiagnosticsService, lifetime)
                    createMemoryControl(this, backendDiagnosticsService, lifetime)
                }.withMargin { margin(0, 15, 0, 25) }
            }
            row {
                horizontalGrid {
                    column {
                        label("Shared Node Resources")
                    }
                }.withMargin { margin(0, 0, 0, 15) }.withHelpTooltip("Shared Node Resources", "The shared metrics represent the used and available resources of the cluster node on which your workspace is running")
            }
        }
    }

    private fun createWorkspaceHeaderRow(ctx: VerticalGridBuilder, backendDiagnosticsService: BackendDiagnosticsService, lifetime: Lifetime) {
        val labelProperty = Property("")

        val workspaceClassMetric = backendDiagnosticsService.getMetric("gitpod_workspace_class")
        val workspaceClass = workspaceClassMetric.toString()

        fun updateLabel() {
            if (workspaceClass != "") {
                labelProperty.set(workspaceClass)
            }
        }
        updateLabel()

        workspaceClassMetric.valueProperty.change.advise(lifetime) {
            updateLabel()
        }

        if (workspaceClass == "") {
            return
        }

        return ctx.row {
            horizontalGrid {
                column {
                    label(workspaceClass)
                }
            }.withMargin { margin(0, 15, 0, 0) }
        }
    }

    private fun createCpuControl(ctx: VerticalGridBuilder, backendDiagnosticsService: BackendDiagnosticsService, lifetime: Lifetime) {
        val cpuUsed = backendDiagnosticsService.getMetric("gitpod_workspace_cpu_used")
        val cpuTotal = backendDiagnosticsService.getMetric("gitpod_workspace_cpu_total")
        val cpuPercentage = backendDiagnosticsService.getMetric("gitpod_workspace_cpu_percentage")
        val cpuPercentageProperty = Property("$cpuPercentage %")
        val label = "CPU"
        val progressBar = createProgressBar(lifetime, cpuPercentage.valueProperty, cpuPercentageProperty)
        val labelProperty = Property("")

        fun updateLabel() {
            labelProperty.set("${cpuUsed}m / ${cpuTotal}m")
        }
        updateLabel()
        cpuUsed.valueProperty.change.advise(lifetime) {
            updateLabel()
        }
        cpuTotal.valueProperty.change.advise(lifetime) {
            updateLabel()
        }
        createProgressRow(ctx, lifetime, label, cpuPercentage.statusProperty, labelProperty, cpuPercentageProperty, progressBar)
    }

    private fun createMemoryControl(ctx: VerticalGridBuilder, backendDiagnosticsService: BackendDiagnosticsService, lifetime: Lifetime) {
        val memoryUsed = backendDiagnosticsService.getMetric("gitpod_workspace_memory_used")
        val memoryTotal = backendDiagnosticsService.getMetric("gitpod_workspace_memory_total")
        val memoryPercentage = backendDiagnosticsService.getMetric("gitpod_workspace_memory_percentage")
        val memoryPercentageProperty = Property("$memoryPercentage %")
        val label = "Memory"
        val progressBar = createProgressBar(lifetime, memoryPercentage.valueProperty, memoryPercentageProperty)
        val labelProperty = Property("")

        fun updateLabel() {
            labelProperty.set("${memoryUsed}GB / ${memoryTotal}GB")
        }
        updateLabel()
        memoryUsed.valueProperty.change.advise(lifetime) {
            updateLabel()
        }
        memoryTotal.valueProperty.change.advise(lifetime) {
            updateLabel()
        }

        createProgressRow(ctx, lifetime, label, memoryPercentage.statusProperty, labelProperty, memoryPercentageProperty, progressBar)
    }
}
