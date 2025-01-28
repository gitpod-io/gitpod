// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.remote

import com.jetbrains.rdserver.unattendedHost.customization.GatewayClientCustomizationProvider
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.DefaultGatewayControlCenterProvider
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.GatewayControlCenterProvider
import com.jetbrains.rdserver.unattendedHost.customization.controlCenter.GatewayHostnameDisplayKind
import io.gitpod.jetbrains.remote.icons.GitpodIcons
import javax.swing.Icon

class GitpodGatewayClientCustomizationProvider : GatewayClientCustomizationProvider {
    override val icon: Icon = GitpodIcons.Logo
    override val title: String = System.getenv("JETBRAINS_GITPOD_WORKSPACE_HOST") ?: DefaultGatewayControlCenterProvider().getHostnameShort()

    override val controlCenter: GatewayControlCenterProvider = object : GatewayControlCenterProvider {
        override fun getHostnameDisplayKind() = GatewayHostnameDisplayKind.ShowHostnameOnNavbar
        override fun getHostnameShort() = System.getenv("GITPOD_WORKSPACE_NAME") ?: title
        override fun getHostnameLong() = title
    }
}
