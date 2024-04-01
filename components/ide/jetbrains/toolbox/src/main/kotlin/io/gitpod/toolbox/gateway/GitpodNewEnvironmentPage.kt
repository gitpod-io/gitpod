package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.ui.ComboBoxField
import com.jetbrains.toolbox.gateway.ui.UiField
import io.gitpod.publicapi.v1.OrganizationOuterClass
import io.gitpod.toolbox.auth.GitpodAuthManager
import io.gitpod.toolbox.components.AbstractUiPage
import io.gitpod.toolbox.service.GitpodPublicApiManager
import io.gitpod.toolbox.service.Utils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory

class GitpodNewEnvironmentPage(publicApi: GitpodPublicApiManager) : AbstractUiPage() {
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun getFields(): MutableList<UiField> {
        return mutableListOf(orgField)
    }

    override fun getTitle(): String {
        return "New environment"
    }

    private val orgState = MutableStateFlow<List<OrganizationOuterClass.Organization>>(emptyList())


    init {
        Utils.coroutineScope.launch {
            val list = publicApi.listOrganizations()
            logger.info("list organizations: $list")
            orgState.emit(list)
            orgState.update {
                publicApi.listOrganizations()
            }
        }
    }

    private val orgField = getOrgField()
    private fun getOrgField(): ComboBoxField<String> {
        return ComboBoxField(
            "Organization",
            "",
            orgState.value.map { ComboBoxField.LabelledValue(it.name, it.id) }.toMutableList(),
        )
    }
}