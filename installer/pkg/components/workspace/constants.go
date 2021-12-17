// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

const (
	Component                    = "workspace"
	ContainerPort                = 23000
	DefaultWorkspaceImage        = "gitpod/workspace-full"
	DefaultWorkspaceImageVersion = "latest"
	CodeIDEImage                 = "ide/code"
	CodeIDEImageStableVersion    = "commit-0d1e8cc5dcc8ccb38efcc2cd6404316b6e7bf4e9" // stable version that will be updated manually on demand
	CodeDesktopIDEImage          = "ide/code-desktop"
	CodeDesktopInsidersIDEImage  = "ide/code-desktop-insiders"
	IntelliJDesktopIDEImage      = "ide/intellij"
	GoLandDesktopIdeImage        = "ide/goland"
	PyCharmDesktopIdeImage       = "ide/pycharm"
	PhpStormDesktopIdeImage      = "ide/phpstorm"
	DockerUpImage                = "docker-up"
	SupervisorImage              = "supervisor"
	WorkspacekitImage            = "workspacekit"
	SupervisorPort               = 22999
)
