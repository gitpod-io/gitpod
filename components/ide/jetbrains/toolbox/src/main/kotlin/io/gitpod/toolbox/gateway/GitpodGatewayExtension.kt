// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.gateway.GatewayExtension
import com.jetbrains.toolbox.gateway.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.gateway.RemoteProvider
import com.jetbrains.toolbox.gateway.ToolboxServiceLocator
import io.gitpod.toolbox.service.Utils

class GitpodGatewayExtension : GatewayExtension {
    override fun createRemoteProviderPluginInstance(serviceLocator: ToolboxServiceLocator): RemoteProvider {
        Utils.initialize(serviceLocator)
        return GitpodRemoteProvider(serviceLocator.getService(RemoteEnvironmentConsumer::class.java))
    }
}
