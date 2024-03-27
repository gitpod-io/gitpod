package io.gitpod.toolbox.auth

import com.jetbrains.toolbox.gateway.ToolboxServiceLocator
import com.jetbrains.toolbox.gateway.ui.ActionDescription
import com.jetbrains.toolbox.gateway.ui.RunnableActionDescription
import com.jetbrains.toolbox.gateway.ui.TextField
import com.jetbrains.toolbox.gateway.ui.ToolboxUi
import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.UiPage
import com.jetbrains.toolbox.gateway.ui.ValidationResult
import java.util.function.BiConsumer
import java.util.function.Function

class GitpodLoginPage(val serviceLocator: ToolboxServiceLocator, val authManager: GitpodAuthManager): UiPage {
    private var stateGetter: Function<UiField, *>? = null
    private val hostField = TextField("Host", "https://exp-migration.preview.gitpod-dev.com", null) {
        if (it.isBlank()) {
            ValidationResult.Invalid("Host should not be empty")
        }
        if (!it.startsWith("https://")) {
            ValidationResult.Invalid("Host should start with https://")
        }
        ValidationResult.Valid
    }

    private val toolboxUi = serviceLocator.getService(ToolboxUi::class.java)

    override fun getFields(): MutableList<UiField> {

        return mutableListOf(hostField)
    }

    override fun getActionButtons(): MutableList<ActionDescription> {
        return mutableListOf(object: RunnableActionDescription {
            override fun getLabel(): String {
                return "Login"
            }

            override fun run() {
                val host = stateGetter?.apply(hostField) ?: return
                val hostStr = host as String
                val url = authManager.getLoginUrl(hostStr)
                toolboxUi.openUrl(url)
            }

            // TODO: enabled only when host is valid
        })
    }

    override fun getTitle(): String {
        return "Login to Gitpod"
    }

    override fun setStateAccessor(setter: BiConsumer<UiField, Any>?, getter: Function<UiField, *>?) {
        super.setStateAccessor(setter, getter)
        stateGetter = getter
    }
}
