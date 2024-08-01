// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import io.gitpod.toolbox.service.Utils
import org.slf4j.LoggerFactory

class GitpodSettings {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val settingsChangedListeners: MutableList<(String, String) -> Unit> = mutableListOf()

    private fun getStoreKey(key: SettingKey) = "GITPOD_SETTINGS:${key.name}"

    private fun updateSetting(key: SettingKey, value: String) {
        logger.debug("updateSetting ${key.name}=$value")
        Utils.settingStore[getStoreKey(key)] = value
        settingsChangedListeners.forEach { it(key.name, value) }
    }

    fun onSettingsChanged(listener: (String, String) -> Unit) {
        settingsChangedListeners.add(listener)
    }

    var organizationId: String?
        get() {
            val value = Utils.settingStore[getStoreKey(SettingKey.ORGANIZATION_ID)]
            return if (value.isNullOrBlank()) null else value
        }
        set(value) {
            updateSetting(SettingKey.ORGANIZATION_ID, value ?: "")
        }

    fun resetSettings(host: String = "gitpod.io") {
        logger.info("=============reset for $host")
        gitpodHost = host
        organizationId = ""
    }

    var gitpodHost: String
        get() = Utils.settingStore[getStoreKey(SettingKey.GITPOD_HOST)] ?: "gitpod.io"
        set(value) {
            updateSetting(SettingKey.GITPOD_HOST, value)
        }

    enum class SettingKey {
        ORGANIZATION_ID,
        GITPOD_HOST
    }
}
