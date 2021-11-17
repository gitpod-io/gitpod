// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

const (
	Component                    = "workspace"
	ContainerPort                = 23000
	DefaultWorkspaceImage        = "gitpod/workspace-full"
	DefaultWorkspaceImageVersion = "latest"
	CodeIDEImage                 = "ide/code" // todo(sje): does this need to be config driven?
	CodeDesktopIDEImage          = "ide/code-desktop"
	CodeDesktopInsidersIDEImage  = "ide/code-desktop-insiders"
	IntelliJDesktopIDEImage      = "ide/intellij"
	GoLandDesktopIdeImage        = "ide/goland"
	DockerUpImage                = "docker-up"
	SupervisorImage              = "supervisor"
	SupervisorPort               = 22999
)
