// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.components

import io.gitpod.toolbox.gateway.GitpodGatewayExtension

@Suppress("FunctionName")
fun GitpodIcon(): ByteArray {
    return GitpodGatewayExtension::class.java.getResourceAsStream("/icon.svg")?.readAllBytes() ?: byteArrayOf()
}
