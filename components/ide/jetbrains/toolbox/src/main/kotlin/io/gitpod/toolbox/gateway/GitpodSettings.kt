// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import io.gitpod.toolbox.service.Utils
import io.gitpod.toolbox.utils.GitpodLogger

class GitpodSettings {
    private val settingsChangedListeners: MutableList<(String, String) -> Unit> = mutableListOf()

    private fun getStoreKey(key: SettingKey) = "GITPOD_SETTINGS:${key.name}"

    private fun updateSetting(key: SettingKey, value: String) {
        GitpodLogger.debug("updateSetting ${key.name}=$value")
        Utils.settingStore[getStoreKey(key)] = value
        settingsChangedListeners.forEach { it(key.name, value) }
    }

    fun onSettingsChanged(listener: (String, String) -> Unit) {
        settingsChangedListeners.add(listener)
    }

    fun resetSettings(host: String = "gitpod.io") {
        gitpodHost = host
    }

    var gitpodHost: String
        get() = Utils.settingStore[getStoreKey(SettingKey.GITPOD_HOST)] ?: "gitpod.io"
        set(value) {
            updateSetting(SettingKey.GITPOD_HOST, value)
        }

    enum class SettingKey {
        GITPOD_HOST
    }
}
