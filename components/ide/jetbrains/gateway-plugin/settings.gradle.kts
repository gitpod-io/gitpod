// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

rootProject.name = "jetbrains-gateway-gitpod-plugin"

include(":gitpod-protocol")
val gitpodProtocolProjectPath: String by settings
project(":gitpod-protocol").projectDir = File(gitpodProtocolProjectPath)
