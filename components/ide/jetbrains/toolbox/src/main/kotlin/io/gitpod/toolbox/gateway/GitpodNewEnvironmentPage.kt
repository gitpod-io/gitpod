// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.ui.ActionDescription
import com.jetbrains.toolbox.gateway.ui.ComboBoxField
import com.jetbrains.toolbox.gateway.ui.TextField
import com.jetbrains.toolbox.gateway.ui.TextType
import com.jetbrains.toolbox.gateway.ui.UiField
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.components.AbstractUiPage
import io.gitpod.toolbox.components.SimpleButton
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory

class GitpodNewEnvironmentPage(val authManager: GitpodAuthManager, val publicApi: GitpodPublicApiManager) :
    AbstractUiPage() {
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun getFields(): MutableList<UiField> {
        return mutableListOf(orgField, contextUrlField, editorField, workspaceClassField)
    }

    override fun getTitle(): String {
        return "New environment"
    }

    override fun getActionButtons(): MutableList<ActionDescription> {
        return mutableListOf(SimpleButton("Create") {
            val contextUrl = getFieldValue<String>(contextUrlField) ?: return@SimpleButton
            val editor = getFieldValue<String>(editorField) ?: return@SimpleButton
            val workspaceClass = getFieldValue<String>(workspaceClassField) ?: return@SimpleButton
            if (contextUrl.isBlank()) {
                setActionErrorMessage("Context URL is required")
                return@SimpleButton
            }
            if (editor.isBlank()) {
                setActionErrorMessage("Editor is required")
                return@SimpleButton
            }
            if (workspaceClass.isBlank()) {
                setActionErrorMessage("Workspace class is required")
                return@SimpleButton
            }
            Utils.coroutineScope.launch {
                val workspace = publicApi.createAndStartWorkspace(contextUrl, editor, workspaceClass, null)
                logger.info("workspace: ${workspace.id} created")
            }
        })
    }

    private val orgField = getOrgField()
    private fun getOrgField(): TextField {
        // TODO: Use ComboBoxField or AutocompleteTextField with org results
        return TextField("Organization", authManager.getCurrentAccount()?.organizationId ?: "", TextType.General)
    }

    // TODO: Use AutocompleteTextField with suggestions from API
    // TODO: Add account recent repositories related field? Or get from auto start options
    private val contextUrlField =
        TextField("Context URL", "https://github.com/Gitpod-Samples/spring-petclinic", TextType.General)

    // TODO: get from API
    private val editorField = ComboBoxField(
        "Editor",
        authManager.getCurrentAccount()?.preferEditor ?: "intellij",
        listOf(
            ComboBoxField.LabelledValue("IntelliJ IDEA", "intellij"),
            ComboBoxField.LabelledValue("Goland", "goland")
        )
    )

    // TODO: get from API
    private val workspaceClassField = ComboBoxField(
        "Workspace Class",
        authManager.getCurrentAccount()?.preferWorkspaceClass ?: "g1-standard",
        listOf(ComboBoxField.LabelledValue("Standard", "g1-standard"), ComboBoxField.LabelledValue("Small", "g1-small"))
    )

    override fun fieldChanged(field: UiField) {
        super.fieldChanged(field)
        val account = authManager.getCurrentAccount() ?: return
        if (field == orgField) {
            val orgId = getFieldValue<String>(orgField) ?: return
            logger.info("set prefer orgId: $orgId")
            account.organizationId = orgId
            // Not works
//            setFieldValue(orgField, orgId)
            return
        }
        if (field == editorField) {
            val editor = getFieldValue<String>(editorField) ?: return
            logger.info("set prefer editor: $editor")
            account.preferEditor = editor
            return
        }
        if (field == workspaceClassField) {
            val cls = getFieldValue<String>(workspaceClassField) ?: return
            logger.info("set prefer workspaceClass: $cls")
            account.preferWorkspaceClass = cls
            // Not works
//            setFieldValue(workspaceClassField, cls)
            return
        }
    }
}
