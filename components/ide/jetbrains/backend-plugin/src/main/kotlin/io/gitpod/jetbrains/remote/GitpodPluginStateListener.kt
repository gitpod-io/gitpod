package io.gitpod.jetbrains.remote

import com.intellij.ide.plugins.IdeaPluginDescriptor
import com.intellij.ide.plugins.PluginStateListener
import com.intellij.openapi.diagnostic.thisLogger

class GitpodPluginStateListener : PluginStateListener {
    override fun install(descriptor: IdeaPluginDescriptor) {
        thisLogger().warn("gitpod: detected installed plugin: ${descriptor.pluginId}:${descriptor.version}")
    }

    override fun uninstall(descriptor: IdeaPluginDescriptor) {
        thisLogger().warn("gitpod: detected uninstalled plugin: ${descriptor.pluginId}:${descriptor.version}")
    }
}
