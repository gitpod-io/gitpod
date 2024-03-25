package toolbox.gateway.sample

import com.jetbrains.toolbox.gateway.*
import kotlinx.coroutines.CoroutineScope
import okhttp3.OkHttpClient

class SampleGatewayExtension : GatewayExtension {
    override fun createRemoteProviderPluginInstance(serviceLocator: ToolboxServiceLocator): RemoteProvider {
        return SampleRemoteProvider(
            serviceLocator.getService(OkHttpClient::class.java),
            serviceLocator.getService(RemoteEnvironmentConsumer::class.java),
            serviceLocator.getService(CoroutineScope::class.java),
        )
    }
}
