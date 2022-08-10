// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.latest

import com.intellij.openapi.components.service
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.Metric
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.MetricType
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.MetricsStatus
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.providers.MetricProvider
import io.gitpod.jetbrains.remote.GitpodManager
import kotlin.math.roundToInt

class GitpodMetricProvider: MetricProvider {
    private val manager = service<GitpodManager>()

    override val id: String = "gitpodMetricsProvider"
    override fun getMetrics(): Map<String, Metric> {
        val resourceStatus = manager.resourceStatus

        val cpuUsed = resourceStatus?.cpu?.used?.toDouble() ?: 0.0
        val cpuTotal = resourceStatus?.cpu?.limit?.toDouble() ?: 0.0
        val cpuPercentage = (cpuUsed / cpuTotal) * 100

        // TODO: retrieve thresholds from supervisor once we implement this: https://github.com/gitpod-io/gitpod/issues/12075
        val cpuStatus = if (cpuPercentage >= 95) {
            MetricsStatus.DANGER
        } else if (cpuPercentage >= 80) {
            MetricsStatus.WARNING
        } else {
            MetricsStatus.NORMAL
        }

        val memoryUsed = convertBytesToGB(resourceStatus?.memory?.used ?: 0)
        val memoryTotal = convertBytesToGB(resourceStatus?.memory?.limit ?: 0)
        val memoryPercentage = (memoryUsed / memoryTotal) * 100

        // TODO: retrieve thresholds from supervisor once we implement this: https://github.com/gitpod-io/gitpod/issues/12075
        val memoryStatus = if (memoryPercentage >= 95) {
            MetricsStatus.DANGER
        } else if (memoryPercentage >= 80) {
            MetricsStatus.WARNING
        } else {
            MetricsStatus.NORMAL
        }

        return mapOf(
                "gitpod_workspace_cpu_used" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(cpuUsed, 0)),
                "gitpod_workspace_cpu_total" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(cpuTotal, 0)),
                "gitpod_workspace_cpu_percentage" to Metric(MetricType.PERFORMANCE, cpuStatus, (cpuPercentage * 1000.0).roundToInt() / 1000.0),
                "gitpod_workspace_memory_used" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(memoryUsed, 2)),
                "gitpod_workspace_memory_total" to Metric(MetricType.PERFORMANCE, MetricsStatus.NORMAL, roundTo(memoryTotal, 2)),
                "gitpod_workspace_memory_percentage" to Metric(MetricType.PERFORMANCE, memoryStatus, (memoryPercentage * 1000.0).roundToInt() / 1000.0)
        )
    }

    private fun convertBytesToGB(bytes: Long) : Double {
        return bytes.div(1073741824.0)
    }

    private fun roundTo(number: Double, decimals: Int) : String {
        return String.format("%.${decimals}f", number)
    }
}
