// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.impl.status.MemoryUsagePanel
import com.intellij.ui.JBColor
import com.intellij.util.ui.JBUI
import java.awt.event.ActionListener
import java.lang.management.ManagementFactory
import javax.swing.Timer
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager

class GitpodSystemMetricsWidget(private val project: Project) : StatusBarWidget {
    private var updateTimer: Timer? = null
    private val memoryPanel = MemoryUsagePanel()
    private var lastNotificationTime = 0L
    private val NOTIFICATION_COOLDOWN = 5 * 60 * 1000 // 5 minutes in milliseconds

    companion object {
        private const val WARNING_THRESHOLD = 0.75 // 75% of max memory
        private const val CRITICAL_THRESHOLD = 0.90 // 90% of max memory
    }

    init {
        startUpdates()
        memoryPanel.border = JBUI.Borders.empty(0, 2)
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
        val usedMemory = memoryBean.heapMemoryUsage.used
        val maxMemory = memoryBean.heapMemoryUsage.max
        val memoryRatio = usedMemory.toDouble() / maxMemory.toDouble()
        val usedMemoryMB = usedMemory / (1024 * 1024)
        val maxMemoryMB = maxMemory / (1024 * 1024)
        val cpuLoad = ManagementFactory.getOperatingSystemMXBean().systemLoadAverage

        val metrics = buildString {
            append("Mem: ${usedMemoryMB}M/${maxMemoryMB}M")
            when {
                memoryRatio >= CRITICAL_THRESHOLD -> append(" ⚠️") // Critical warning
                memoryRatio >= WARNING_THRESHOLD -> append(" ⚠") // Warning
            }
            append(" | CPU: %.1f%%".format(cpuLoad * 100))
        }

        memoryPanel.text = metrics

        // Update text color based on memory usage
        memoryPanel.foreground = when {
            memoryRatio >= CRITICAL_THRESHOLD -> JBColor.RED
            memoryRatio >= WARNING_THRESHOLD -> JBColor.ORANGE
            else -> JBColor.foreground()
        }

        memoryPanel.parent?.repaint()

        if (memoryRatio >= CRITICAL_THRESHOLD) {
            showMemoryWarning(usedMemoryMB, maxMemoryMB)
        }
    }

    private fun showMemoryWarning(usedMemoryMB: Long, maxMemoryMB: Long) {
        val now = System.currentTimeMillis()
        if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
            return
        }

        lastNotificationTime = now

        ApplicationManager.getApplication().invokeLater {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Gitpod Notifications")
                .createNotification(
                    "High Memory Usage Warning",
                    "Memory usage is critically high (${usedMemoryMB}MB/${maxMemoryMB}MB). Consider saving your work and restarting the IDE.",
                    NotificationType.WARNING
                ).notify(project)
        }
    }

    override fun install(statusBar: StatusBar) {
        statusBar.addWidget(memoryPanel)
    }

    override fun dispose() {
        stopUpdates()
    }

    override fun ID(): String = "GitpodSystemMetricsWidget"
}
