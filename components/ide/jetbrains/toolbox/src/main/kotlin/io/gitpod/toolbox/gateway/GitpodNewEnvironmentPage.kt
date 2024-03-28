package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.ui.UiField
import io.gitpod.toolbox.components.AbstractUiPage

class GitpodNewEnvironmentPage : AbstractUiPage() {
    override fun getFields(): MutableList<UiField> {
        return mutableListOf()
    }

    override fun getTitle(): String {
        return "New environment"
    }
}