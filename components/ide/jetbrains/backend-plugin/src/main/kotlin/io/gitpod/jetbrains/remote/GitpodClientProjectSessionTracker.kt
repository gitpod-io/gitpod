// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.client.ClientProjectSession
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.fileTypes.LanguageFileType
import io.gitpod.gitpodprotocol.api.entities.RemoteTrackMessage
import io.gitpod.supervisor.api.Info
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch

class GitpodClientProjectSessionTracker(
        private val session: ClientProjectSession
) {

    private val manager = service<GitpodManager>()

    private lateinit var info: Info.WorkspaceInfoResponse
    private val versionName = ApplicationInfo.getInstance().versionName
    private val fullVersion = ApplicationInfo.getInstance().fullVersion

    init {
        GlobalScope.launch {
            info = manager.pendingInfo.await()
            trackEvent("jb_session", mapOf())
            registerActiveLanguageAnalytics()
        }
    }

    private fun registerActiveLanguageAnalytics() {
        val activeLanguages = mutableSetOf<String>()
        session.project.messageBus.connect().subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
            override fun selectionChanged(event: FileEditorManagerEvent) {
                super.selectionChanged(event)
                if (event.manager.selectedEditor == null) {
                    return
                }
                val file = event.manager.selectedEditor!!.file
                val ext = file.extension
                val fileType = file.fileType
                var lang = "plaintext"
                if (fileType is LanguageFileType) {
                    lang = fileType.language.id
                }
                if (activeLanguages.contains(lang)) {
                    return
                }
                activeLanguages.add(lang)
                trackEvent("jb_active_language", mapOf("lang" to lang, "ext" to ext))
            }
        })
    }

    fun trackEvent(eventName: String, props: Map<String, Any?>) {
        val event = RemoteTrackMessage().apply {
            event = eventName
            properties = mapOf(
                    "sessionId" to session.clientId.value,
                    "instanceId" to info.instanceId,
                    "workspaceId" to info.workspaceId,
                    "appName" to versionName,
                    "appVersion" to fullVersion,
                    "timestamp" to System.currentTimeMillis()
            ).plus(props)
        }
        if (manager.devMode) {
            thisLogger().warn("gitpod: $event")
        } else {
            manager.client.server.trackEvent(event)
        }
    }
}
