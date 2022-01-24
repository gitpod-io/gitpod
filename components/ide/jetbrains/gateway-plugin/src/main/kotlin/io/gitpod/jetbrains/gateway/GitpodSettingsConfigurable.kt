// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.openapi.components.service
import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.openapi.ui.ValidationInfo
import com.intellij.ui.components.JBTextField
import com.intellij.ui.dsl.builder.LabelPosition
import com.intellij.ui.dsl.builder.bindText
import com.intellij.ui.dsl.builder.panel
import com.intellij.ui.dsl.gridLayout.HorizontalAlign
import com.intellij.ui.layout.ValidationInfoBuilder

class GitpodSettingsConfigurable : BoundConfigurable("Gitpod") {

    override fun createPanel(): DialogPanel {
        val state = service<GitpodSettingsState>()
        return panel {
            row {
                textField()
                    .label("Gitpod Host:", LabelPosition.LEFT)
                    .horizontalAlign(HorizontalAlign.FILL)
                    .bindText(state::gitpodHost)
                    .validationOnApply(::validateGitpodHost)
                    .validationOnInput(::validateGitpodHost)
            }
        }
    }

    private fun validateGitpodHost(
        builder: ValidationInfoBuilder,
        gitpodHost: JBTextField
    ): ValidationInfo? {
        return builder.run {
            if (gitpodHost.text.isBlank()) {
                return@run error("may not be empty")
            }
            return@run null
        }
    }

}