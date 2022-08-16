// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.jetbrains.ide.model.uiautomation.BeControl
import com.jetbrains.rd.ui.bedsl.dsl.VerticalGridBuilder
import com.jetbrains.rd.ui.bedsl.dsl.verticalGrid
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.reactive.Property
import com.jetbrains.rdserver.diagnostics.BackendDiagnosticsService
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.MetricControlProvider
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressBar
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressRow

class GitpodMetricControlProvider : MetricControlProvider {
    override val id: String = "gitpodMetricsControl"
    override fun getControl(lifetime: Lifetime): BeControl {
        return verticalGrid {
            val backendDiagnosticsService = BackendDiagnosticsService.Companion.getInstance()
            createCpuControl(this, backendDiagnosticsService, lifetime)
            createMemoryControl(this, backendDiagnosticsService, lifetime)
        }
    }

    private fun createCpuControl(ctx: VerticalGridBuilder, backendDiagnosticsService: BackendDiagnosticsService, lifetime: Lifetime) {
        val cpuUsed = backendDiagnosticsService.getMetric("gitpod_workspace_cpu_used")
        val cpuTotal = backendDiagnosticsService.getMetric("gitpod_workspace_cpu_total")
        val cpuPercentage = backendDiagnosticsService.getMetric("gitpod_workspace_cpu_percentage")
        val cpuPercentageProperty = Property("$cpuPercentage %")
        val label = "Workspace CPU"
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
        val label = "Workspace Memory"
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
