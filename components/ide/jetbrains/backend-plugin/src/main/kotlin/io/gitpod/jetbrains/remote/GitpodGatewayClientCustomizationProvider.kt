package io.gitpod.jetbrains.remote

import com.jetbrains.rdserver.unattendedHost.customization.GatewayClientCustomizationProvider
import com.jetbrains.rdserver.unattendedHost.customization.GatewayExitCustomizationProvider
import javax.swing.Icon
import io.gitpod.jetbrains.remote.icons.GitpodIcons

class GitpodGatewayClientCustomizationProvider : GatewayClientCustomizationProvider {
    override val icon: Icon = GitpodIcons.Logo
    override val title: String = System.getenv("GITPOD_WORKSPACE_ID") ?: "Gitpod"

    override val exitCustomization: GatewayExitCustomizationProvider = object: GatewayExitCustomizationProvider {
        override val body: String = "1"
        override val isEnabled: Boolean = true
        override val primaryActionButtonText: String = "2"
        override val rememberId: String = "3"
        override val title: String = "4"

        override fun primaryAction() {
            TODO("Not yet implemented")
        }

        override fun primaryActionWillExit(): Boolean {
            TODO("Not yet implemented")
        }
    }
}