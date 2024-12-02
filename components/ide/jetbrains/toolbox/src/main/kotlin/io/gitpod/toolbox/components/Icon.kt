// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.components

import com.jetbrains.toolbox.api.core.ui.icons.SvgIcon
import io.gitpod.toolbox.gateway.GitpodGatewayExtension

@Suppress("FunctionName")
fun GitpodIconGray(): SvgIcon {
    return SvgIcon(GitpodGatewayExtension::class.java.getResourceAsStream("/icon-gray.svg")?.readAllBytes() ?: byteArrayOf())
}

@Suppress("FunctionName")
fun GitpodIcon(): SvgIcon {
    return SvgIcon(GitpodGatewayExtension::class.java.getResourceAsStream("/icon.svg")?.readAllBytes() ?: byteArrayOf())
}

