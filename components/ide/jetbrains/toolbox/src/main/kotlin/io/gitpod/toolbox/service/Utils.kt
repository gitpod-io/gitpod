package io.gitpod.toolbox.service

import com.jetbrains.toolbox.gateway.PluginSettingsStore
import com.jetbrains.toolbox.gateway.ToolboxServiceLocator
import com.jetbrains.toolbox.gateway.ui.ToolboxUi
import io.gitpod.toolbox.auth.GitpodAuthManager
import kotlinx.coroutines.CoroutineScope
import java.util.concurrent.atomic.AtomicBoolean

object Utils {
    lateinit var sharedServiceLocator: ToolboxServiceLocator private set
    lateinit var coroutineScope: CoroutineScope private set
    lateinit var settingStore: PluginSettingsStore private set

    lateinit var dataManager: DataManager private set

    lateinit var toolboxUi: ToolboxUi private set

    fun initialize(serviceLocator: ToolboxServiceLocator) {
        if (!isInitialized.compareAndSet(false, true)) {
            return
        }
        sharedServiceLocator = serviceLocator
        coroutineScope = serviceLocator.getService(CoroutineScope::class.java)
        toolboxUi = serviceLocator.getService(ToolboxUi::class.java)
        settingStore = serviceLocator.getService(PluginSettingsStore::class.java)
        dataManager = DataManager()
    }

    fun openUrl(url: String) {
        toolboxUi.openUrl(url)
    }

    private val isInitialized = AtomicBoolean(false)
}