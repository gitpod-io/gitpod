// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.components.service
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.Metric
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.MetricType
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.MetricsStatus
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.providers.MetricProvider
import io.gitpod.supervisor.api.Info.WorkspaceInfoResponse.WorkspaceClass
import io.gitpod.supervisor.api.Status.ResourceStatusSeverity
import kotlin.math.roundToInt

class GitpodMetricProvider: MetricProvider {
    private val manager = service<GitpodManager>()

    override val id: String = "gitpodMetricsProvider"
    override fun getMetrics(): Map<String, Metric> {
        val resourceStatus = manager.resourceStatus
        val info = manager.infoResponse

        val cpuUsed = resourceStatus?.cpu?.used?.toDouble() ?: 0.0
        val cpuTotal = resourceStatus?.cpu?.limit?.toDouble() ?: 0.0
        val cpuSeverity = resourceStatus?.cpu?.severity ?: ResourceStatusSeverity.normal
        val cpuPercentage = (cpuUsed / cpuTotal) * 100
        val cpuStatus = getSeverityStatus(cpuSeverity)

        val memoryUsed = convertBytesToGB(resourceStatus?.memory?.used ?: 0)
        val memoryTotal = convertBytesToGB(resourceStatus?.memory?.limit ?: 0)
        val memorySeverity = resourceStatus?.memory?.severity ?: ResourceStatusSeverity.normal
        val memoryPercentage = (memoryUsed / memoryTotal) * 100
        val memoryStatus = getSeverityStatus(memorySeverity)

        val workspaceClass = formatWorkspaceClass(info?.workspaceClass)

        return mapOf(
                "gitpod_workspace_cpu_used" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(cpuUsed, 0)),
                "gitpod_workspace_cpu_total" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(cpuTotal, 0)),
                "gitpod_workspace_cpu_percentage" to Metric(MetricType.PERFORMANCE, cpuStatus, (cpuPercentage * 1000.0).roundToInt() / 1000.0),
                "gitpod_workspace_memory_used" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(memoryUsed, 2)),
                "gitpod_workspace_memory_total" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(memoryTotal, 2)),
                "gitpod_workspace_memory_percentage" to Metric(MetricType.PERFORMANCE, memoryStatus, (memoryPercentage * 1000.0).roundToInt() / 1000.0),
                "gitpod_workspace_class" to Metric(MetricType.OTHER, MetricsStatus.NORMAL, workspaceClass)
        )
    }

    private fun convertBytesToGB(bytes: Long) : Double {
        return bytes.div(1073741824.0)
    }

    private fun roundTo(number: Double, decimals: Int) : String {
        return String.format("%.${decimals}f", number)
    }

    private fun getSeverityStatus(severity: ResourceStatusSeverity) : MetricsStatus {
        return if (severity == ResourceStatusSeverity.danger) {
            MetricsStatus.DANGER
        } else if (severity == ResourceStatusSeverity.warning) {
            MetricsStatus.WARNING
        } else {
            MetricsStatus.NORMAL
        }
    }

    private fun formatWorkspaceClass(workspaceClass: WorkspaceClass?): String {
        if (workspaceClass == null || workspaceClass.displayName == "") {
            return ""
        }

        if (workspaceClass.description == "") {
            return workspaceClass.displayName
        }

        return "${workspaceClass.displayName}: ${workspaceClass.description}"
    }
}
