package toolbox.gateway.sample

import com.jetbrains.toolbox.gateway.EnvironmentVisibilityState
import com.jetbrains.toolbox.gateway.RemoteProviderEnvironment
import com.jetbrains.toolbox.gateway.environments.EnvironmentContentsView
import com.jetbrains.toolbox.gateway.states.EnvironmentStateConsumer
import com.jetbrains.toolbox.gateway.ui.ActionListener
import java.util.concurrent.CompletableFuture

class SampleRemoteEnvironment(
    private val environment: EnvironmentDTO
) : RemoteProviderEnvironment {
    private val stateListeners = mutableSetOf<EnvironmentStateConsumer>()
    private val actionListeners = mutableSetOf<ActionListener>()
    override fun getId(): String = environment.id
    override fun getName(): String = environment.name
    override fun addStateListener(p0: EnvironmentStateConsumer?): Boolean {
       return if (p0 != null) {
           stateListeners += p0
           true
       } else false
    }

    override fun removeStateListener(p0: EnvironmentStateConsumer?) {
       if (p0 != null) {
           stateListeners -= p0
       }
    }

    override fun getContentsView(): CompletableFuture<EnvironmentContentsView> {
        return CompletableFuture.completedFuture(SampleEnvironmentContentsView())
    }

    override fun setVisible(visibilityState: EnvironmentVisibilityState) {
    }

    override fun registerActionListener(p0: ActionListener) {
        actionListeners += p0
    }

    override fun unregisterActionListener(p0: ActionListener) {
        actionListeners -= p0
    }
}
