package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.environments.ManualEnvironmentContentsView

class GitpodEmptyEnvironmentContentsView : ManualEnvironmentContentsView {
    override fun addEnvironmentContentsListener(listener: ManualEnvironmentContentsView.Listener) {
    }

    override fun removeEnvironmentContentsListener(listener: ManualEnvironmentContentsView.Listener) {
    }
}
