// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.auth

import com.jetbrains.toolbox.api.core.ui.icons.SvgIcon
import com.jetbrains.toolbox.api.ui.actions.ActionDescription
import com.jetbrains.toolbox.api.ui.components.LinkField
import com.jetbrains.toolbox.api.ui.components.TextField
import com.jetbrains.toolbox.api.ui.components.UiField
import com.jetbrains.toolbox.api.ui.components.ValidationResult
import io.gitpod.toolbox.components.AbstractUiPage
import io.gitpod.toolbox.components.GitpodIcon
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.Utils
import java.net.URI
import java.net.URL

class GitpodLoginPage(private val authManager: GitpodAuthManager) : AbstractUiPage() {
    private val hostField = TextField("Host", "exp-migration.preview.gitpod-dev.com", null) {
        val (result) = isValidHost(it)
        result
    }

    override fun getFields(): MutableList<UiField> {
        return mutableListOf(hostField, LinkField("Learn more", "https://gitpod.io/docs"))
    }


    override fun getActionButtons(): List<ActionDescription> {
        return listOf(SimpleButton("Login") action@{
            val hostString = getFieldValue<String>(hostField) ?: return@action
            val (result, host) = isValidHost(hostString)
            if (result != ValidationResult.Valid) {
                Utils.toolboxUi.showErrorInfoPopup(IllegalArgumentException(result.errorMessage ?: "Invalid host value"))
                return@action
            }
            val url = authManager.getOAuthLoginUrl(host)
            Utils.openUrl(url)
        })
    }

    override fun getTitle() = "Log in to Gitpod Classic"

    override fun getDescription() = "Always ready to code."

    override fun getSvgIcon(): SvgIcon {
        return GitpodIcon()
    }

    private fun isValidHost(it: String): Pair<ValidationResult, String> {
        if (it.isBlank()) {
            return ValidationResult.Invalid("Host cannot be empty") to ""
        }
        val host = try {
            if (!it.startsWith("https://")) {
                URI.create("https://$it").host
            } else {
                URI.create(it).host
            }
        } catch (e: Exception) {
            return ValidationResult.Invalid("Invalid host value $e") to it
        }
        return ValidationResult.Valid to host
    }
}
