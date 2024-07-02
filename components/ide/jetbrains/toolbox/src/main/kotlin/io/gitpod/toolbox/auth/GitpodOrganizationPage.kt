// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.auth

import com.jetbrains.toolbox.gateway.ui.AutocompleteTextField
import com.jetbrains.toolbox.gateway.ui.AutocompleteTextField.AutocompleteItem
import com.jetbrains.toolbox.gateway.ui.AutocompleteTextField.MenuItem
import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.ValidationResult
import io.gitpod.publicapi.v1.OrganizationOuterClass
import io.gitpod.toolbox.components.AbstractUiPage
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import java.util.function.Consumer

class GitpodOrganizationPage(val authManager: GitpodAuthManager, val publicApi: GitpodPublicApiManager) :
    AbstractUiPage() {
    private var organizations = emptyList<OrganizationOuterClass.Organization>()
    private lateinit var orgField: AutocompleteTextField


    suspend fun loadData() {
        organizations = publicApi.listOrganizations()
    }

    private fun getOrgField() = run {
        val options = mutableListOf<AutocompleteItem>()
        options.addAll(organizations.map { org ->
            MenuItem(org.name, null, null) {
                authManager.getCurrentAccount()?.organizationId = org.id
                Utils.toolboxUi.hideUiPage(this)
            }
        })
        val orgName = organizations.find { it.id == authManager.getCurrentAccount()?.organizationId }?.name ?: ""
        AutocompleteTextField("Organization", orgName, options, 1.0f) {
            if (it.isNullOrEmpty()) {
                ValidationResult.Invalid("Organization is required")
            }
            ValidationResult.Valid
        }
    }

    override fun getFields(): MutableList<UiField> {
        this.orgField = getOrgField()
        return mutableListOf(this.orgField)
    }

    override fun getTitle(): String {
        return "Select organization"
    }

    override fun setPageChangedListener(listener: Consumer<UiField?>) {
        super.setPageChangedListener(listener)
        listener.accept(null)
    }
}
