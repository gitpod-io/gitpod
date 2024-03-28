package io.gitpod.toolbox.auth

import com.jetbrains.toolbox.gateway.ui.ActionDescription
import com.jetbrains.toolbox.gateway.ui.TextField
import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.ValidationResult
import io.gitpod.toolbox.components.AbstractUiPage
import io.gitpod.toolbox.components.GitpodIcon
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.Utils

class GitpodLoginPage(private val authManager: GitpodAuthManager) : AbstractUiPage() {
    private val hostField = TextField("Host", "https://exp-migration.preview.gitpod-dev.com", null) {
        if (it.isBlank()) {
            ValidationResult.Invalid("Host should not be empty")
        }
        if (!it.startsWith("https://")) {
            ValidationResult.Invalid("Host should start with https://")
        }
        ValidationResult.Valid
    }

    override fun getFields(): MutableList<UiField> {
        return mutableListOf(hostField)
    }

    override fun getActionButtons(): MutableList<ActionDescription> {
        return mutableListOf(SimpleButton("Login") action@{
            val host = getFieldValue<String>(hostField) ?: return@action
            val url = authManager.getOAuthLoginUrl(host)
            Utils.openUrl(url)
        })
    }

    override fun getTitle(): String {
        return "Login to Gitpod"
    }

    override fun getDescription(): String? {
        return "Always ready to code."
    }

    override fun getSvgIcon(): ByteArray {
        return GitpodIcon()
    }
}
