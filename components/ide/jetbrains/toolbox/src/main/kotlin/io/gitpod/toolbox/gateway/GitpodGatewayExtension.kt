// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.gateway

import com.jetbrains.toolbox.api.core.ServiceLocator
import com.jetbrains.toolbox.api.remoteDev.RemoteDevExtension
import com.jetbrains.toolbox.api.remoteDev.RemoteEnvironmentConsumer
import com.jetbrains.toolbox.api.remoteDev.RemoteProvider
import io.gitpod.toolbox.service.Utils

class GitpodGatewayExtension : RemoteDevExtension {
    override fun createRemoteProviderPluginInstance(serviceLocator: ServiceLocator): RemoteProvider {
        Utils.initialize(serviceLocator)
        return GitpodRemoteProvider(serviceLocator.getService(RemoteEnvironmentConsumer::class.java))
    }
}
