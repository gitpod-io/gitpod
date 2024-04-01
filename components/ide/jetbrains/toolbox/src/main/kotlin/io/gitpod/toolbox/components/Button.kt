package io.gitpod.toolbox.components

import com.jetbrains.toolbox.gateway.ui.RunnableActionDescription

open class SimpleButton(private val title: String, private val action: () -> Unit = {}): RunnableActionDescription {
    override fun getLabel(): String {
        return title
    }
    override fun run() {
        action()
    }
}