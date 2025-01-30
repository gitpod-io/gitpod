// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.impl.status.MemoryUsagePanel
import java.awt.event.ActionListener
import java.lang.management.ManagementFactory
import javax.swing.Timer

class GitpodSystemMetricsWidget(private val project: Project) : StatusBarWidget {
    private var updateTimer: Timer? = null
    private val memoryPanel = MemoryUsagePanel()

    init {
        startUpdates()
    }

    private fun startUpdates() {
        updateTimer = Timer(1000, ActionListener {
            if (project.isDisposed) {
                stopUpdates()
                return@ActionListener
            }
            updateMetrics()
        }).apply { start() }
    }

    private fun stopUpdates() {
        updateTimer?.stop()
        updateTimer = null
    }

    private fun updateMetrics() {
        val memoryBean = ManagementFactory.getMemoryMXBean()
        val usedMemory = memoryBean.heapMemoryUsage.used / (1024 * 1024)
        val maxMemory = memoryBean.heapMemoryUsage.max / (1024 * 1024)
        val cpuLoad = ManagementFactory.getOperatingSystemMXBean().systemLoadAverage

        val metrics = "Mem: ${usedMemory}M/${maxMemory}M | CPU: %.1f%%".format(cpuLoad * 100)
        memoryPanel.text = metrics
        memoryPanel.parent?.repaint()
    }

    override fun install(statusBar: StatusBar) {
        statusBar.addWidget(memoryPanel)
    }

    override fun dispose() {
        stopUpdates()
    }

    override fun ID(): String = "GitpodSystemMetricsWidget"
}
