// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import com.jetbrains.toolbox.api.core.PluginSettingsStore
import com.jetbrains.toolbox.api.core.ServiceLocator
import com.jetbrains.toolbox.api.core.os.LocalDesktopManager
import com.jetbrains.toolbox.api.remoteDev.connection.ClientHelper
import com.jetbrains.toolbox.api.remoteDev.connection.ToolboxProxySettings
import com.jetbrains.toolbox.api.remoteDev.ssh.validation.SshConnectionValidator
import com.jetbrains.toolbox.api.remoteDev.states.EnvironmentStateColorPalette
import com.jetbrains.toolbox.api.remoteDev.ui.EnvironmentUiPageManager
import com.jetbrains.toolbox.api.ui.ToolboxUi
import com.jetbrains.toolbox.api.ui.observables.ObservablePropertiesFactory
import io.gitpod.toolbox.gateway.GitpodSettings
import kotlinx.coroutines.CoroutineScope
import okhttp3.OkHttpClient
import java.net.Proxy
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean

object Utils {
    lateinit var sharedServiceLocator: ServiceLocator private set
    lateinit var coroutineScope: CoroutineScope private set
    lateinit var settingStore: PluginSettingsStore private set
    lateinit var sshConnectionValidator: SshConnectionValidator private set
    lateinit var httpClient: OkHttpClient private set
    lateinit var clientHelper: ClientHelper private set
    lateinit var observablePropertiesFactory: ObservablePropertiesFactory private set
    lateinit var proxySettings: ToolboxProxySettings private set

    lateinit var gitpodSettings: GitpodSettings private set

    lateinit var toolboxUi: ToolboxUi private set
    lateinit var environmentStateColorPalette: EnvironmentStateColorPalette private set
    lateinit var localDesktopManager: LocalDesktopManager private set
    lateinit var environmentUiPageManager: EnvironmentUiPageManager private set


    fun initialize(serviceLocator: ServiceLocator) {
        if (!isInitialized.compareAndSet(false, true)) {
            return
        }
        sharedServiceLocator = serviceLocator
        coroutineScope = serviceLocator.getService(CoroutineScope::class.java)
        toolboxUi = serviceLocator.getService(ToolboxUi::class.java)
        localDesktopManager = serviceLocator.getService(LocalDesktopManager::class.java)
        environmentStateColorPalette = serviceLocator.getService(EnvironmentStateColorPalette::class.java)
        environmentUiPageManager = serviceLocator.getService(EnvironmentUiPageManager::class.java)
        settingStore = serviceLocator.getService(PluginSettingsStore::class.java)
        sshConnectionValidator = serviceLocator.getService(SshConnectionValidator::class.java)
        httpClient = serviceLocator.getService(OkHttpClient::class.java)
        clientHelper = serviceLocator.getService(ClientHelper::class.java)
        observablePropertiesFactory = serviceLocator.getService(ObservablePropertiesFactory::class.java)
        proxySettings = serviceLocator.getService(ToolboxProxySettings::class.java)
        gitpodSettings = GitpodSettings()
    }

    fun openUrl(url: String) {
        localDesktopManager.openUrl(URI(url).toURL())
    }

    fun getProxyList(): List<Proxy> {
        val proxyList = mutableListOf<Proxy>()
        if (proxySettings.proxy != null && proxySettings.proxy != Proxy.NO_PROXY) {
            proxyList.add(proxySettings.proxy!!)
        }
        return proxyList
    }

    private val isInitialized = AtomicBoolean(false)
}
