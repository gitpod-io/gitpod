// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

const (
	ContainerPort                = 23000
	DefaultWorkspaceImage        = "gitpod/workspace-full"
	DefaultWorkspaceImageVersion = "latest"
	IDEImageRepo                 = "ide/code" // todo(sje): does this need to be config driven?
	DockerUpImage                = "docker-up"
	SupervisorImage              = "supervisor"
	SupervisorPort               = 22999
)
