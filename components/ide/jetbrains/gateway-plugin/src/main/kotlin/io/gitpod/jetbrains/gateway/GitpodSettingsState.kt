// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.gateway

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.EventDispatcher
import com.intellij.util.xmlb.XmlSerializerUtil
import java.net.URL
import java.util.*

@State(
    name = "io.gitpod.jetbrains.gateway.GitpodSettingsState",
    storages = [Storage("gitpod.xml")]
)
class GitpodSettingsState : PersistentStateComponent<GitpodSettingsState> {

    var gitpodHost: String = "gitpod.io"
        set(value) {
            if (value.isNullOrBlank()) {
                return;
            }
            val gitpodHost = try {
                URL(value.trim()).host
            } catch (t: Throwable) {
                value.trim()
            }
            if (gitpodHost == field) {
                return
            }
            field = gitpodHost
            dispatcher.multicaster.didChange()
        }

    private interface Listener : EventListener {
        fun didChange()
    }

    private val dispatcher = EventDispatcher.create(Listener::class.java)
    fun addListener(listener: () -> Unit): Disposable {
        val internalListener = object : Listener {
            override fun didChange() {
                listener()
            }
        }
        dispatcher.addListener(internalListener);
        return Disposable { dispatcher.removeListener(internalListener) }
    }

    override fun getState(): GitpodSettingsState {
        return this
    }

    override fun loadState(state: GitpodSettingsState) {
        XmlSerializerUtil.copyBean(state, this)
    }

}