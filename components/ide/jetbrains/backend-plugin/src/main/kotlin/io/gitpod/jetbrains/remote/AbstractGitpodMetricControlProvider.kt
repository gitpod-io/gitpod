// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.jetbrains.ide.model.uiautomation.BeControl
import com.jetbrains.ide.model.uiautomation.DefiniteProgress
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.Metric
import com.jetbrains.rd.ui.bedsl.dsl.*
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.reactive.Property
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.MetricControlProvider
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressBar

interface IBackendDiagnosticsService {
    fun getMetric(name: String): com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.Metric
}

abstract class AbstractGitpodMetricControlProvider : MetricControlProvider {
    override val id: String = "gitpodMetricsControl"

    abstract fun setMargin(element: BeControl, left: Int, top: Int, right: Int, bottom: Int): BeControl;

    abstract fun getBackendDiagnosticsService(): IBackendDiagnosticsService

    override fun getControl(lifetime: Lifetime): BeControl {
        val backendDiagnosticsService = this.getBackendDiagnosticsService()
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
                setMargin(verticalGrid {
                    createCpuControl(this, backendDiagnosticsService, lifetime)
                    createMemoryControl(this, backendDiagnosticsService, lifetime)
                }, 0, 15, 0, 25)
            }

            row {
                setMargin(horizontalGrid {
                    column {
                        label("Shared Node Resources")
                    }
                }, 0, 0, 0, 15).withHelpTooltip("Shared Node Resources", "The shared metrics represent the used and available resources of the cluster node on which your workspace is running")
            }
        }
    }

    private fun createWorkspaceHeaderRow(ctx: VerticalGridBuilder, backendDiagnosticsService: IBackendDiagnosticsService, lifetime: Lifetime) {
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
            setMargin(horizontalGrid {
                column {
                    label(workspaceClass)
                }
            },0, 15, 0, 0)
        }
    }

    private fun createCpuControl(ctx: VerticalGridBuilder, backendDiagnosticsService: IBackendDiagnosticsService, lifetime: Lifetime) {
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
        createProgressControl(ctx, lifetime, label, cpuPercentage, labelProperty, cpuPercentageProperty, progressBar)
    }

    private fun createMemoryControl(ctx: VerticalGridBuilder, backendDiagnosticsService: IBackendDiagnosticsService, lifetime: Lifetime) {
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

        createProgressControl(ctx, lifetime, label, memoryPercentage, labelProperty, memoryPercentageProperty, progressBar)
    }

    protected abstract fun createProgressControl(ctx: VerticalGridBuilder, lifetime: Lifetime, label: String, cpuPercentage: Metric, labelProperty: Property<String>, cpuPercentageProperty: Property<String>, progressBar: DefiniteProgress)
}
