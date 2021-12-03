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
	CodeIDEImageStableVersion    = "commit-d8477d484d00967a92686642b33541aed824cb63" // stable version that will be updated manually on demand
	CodeDesktopIDEImage          = "ide/code-desktop"
	CodeDesktopInsidersIDEImage  = "ide/code-desktop-insiders"
	IntelliJDesktopIDEImage      = "ide/intellij"
	GoLandDesktopIdeImage        = "ide/goland"
	PyCharmDesktopIdeImage       = "ide/pycharm"
	PhpStormDesktopIdeImage      = "ide/phpstorm"
	DockerUpImage                = "docker-up"
	SupervisorImage              = "supervisor"
	SupervisorPort               = 22999
)
