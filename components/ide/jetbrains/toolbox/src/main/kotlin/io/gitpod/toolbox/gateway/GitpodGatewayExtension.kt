package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.GatewayExtension
import com.jetbrains.toolbox.gateway.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.gateway.RemoteProvider
import com.jetbrains.toolbox.gateway.ToolboxServiceLocator
import io.gitpod.toolbox.service.Utils
import okhttp3.OkHttpClient

class GitpodGatewayExtension : GatewayExtension {
    override fun createRemoteProviderPluginInstance(serviceLocator: ToolboxServiceLocator): RemoteProvider {
        Utils.initialize(serviceLocator)
        return GitpodRemoteProvider(
                serviceLocator.getService(OkHttpClient::class.java),
                serviceLocator.getService(RemoteEnvironmentConsumer::class.java),
        )
    }
}
