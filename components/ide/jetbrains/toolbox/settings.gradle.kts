// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

rootProject.name = "gitpod-toolbox-gateway"

include(":supervisor-api")
val supervisorApiProjectPath: String by settings
project(":supervisor-api").projectDir = File(supervisorApiProjectPath)

include(":gitpod-publicapi")
val gitpodPublicApiProjectPath: String by settings
project(":gitpod-publicapi").projectDir = File(gitpodPublicApiProjectPath)
