// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote.stable

import com.jetbrains.ide.model.uiautomation.DefiniteProgress
import com.jetbrains.rd.platform.codeWithMe.unattendedHost.metrics.Metric
import com.jetbrains.rd.ui.bedsl.dsl.*
import com.jetbrains.rd.util.lifetime.Lifetime
import com.jetbrains.rd.util.reactive.Property
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.performance.createProgressRow
import io.gitpod.jetbrains.remote.AbstractGitpodMetricControlProvider

class StableGitpodMetricControlProvider: AbstractGitpodMetricControlProvider() {

    override fun createProgressControl(ctx: VerticalGridBuilder, lifetime: Lifetime, label: String, cpuPercentage: Metric, labelProperty: Property<String>, cpuPercentageProperty: Property<String>, progressBar: DefiniteProgress) {
        createProgressRow(ctx, lifetime, label, cpuPercentage.statusProperty, labelProperty, cpuPercentageProperty, progressBar)
    }
}
