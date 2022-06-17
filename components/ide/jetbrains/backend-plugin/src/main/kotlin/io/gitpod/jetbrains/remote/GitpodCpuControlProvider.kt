// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.jetbrains.ide.model.uiautomation.BeControl
import com.jetbrains.rd.ui.bedsl.dsl.verticalGrid
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rdserver.diagnostics.BackendDiagnosticsService
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.MetricControlProvider
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createMetricProgressWithLabels
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressBar
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressRow

class GitpodCpuControlProvider(override val id: String  ="gitpodCpuControlProvider") : MetricControlProvider {

    override fun getControl(lifetime: Lifetime): BeControl {
        val progressWithLabels = createMetricProgressWithLabels(BackendDiagnosticsService.getInstance(), lifetime, GitpodMetricProvider.GITPOD_CPU_TOTAL, GitpodMetricProvider.GITPOD_CPU_USED, GitpodMetricProvider.GITPOD_CPU_PERCENTAGE)
        return verticalGrid {
            val metric = BackendDiagnosticsService.getInstance().getMetric(GitpodMetricProvider.GITPOD_CPU_PERCENTAGE)
            createProgressRow(this, lifetime,
                "Workspace CPU (MILLICORES)",
                metric.statusProperty,
                progressWithLabels.first,
                progressWithLabels.second,
                progressWithLabels.third
            )
        }
    }
}
