// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const (
	Component         = common.RegistryFacadeComponent
	ContainerPortName = "registry"
	ContainerPort     = 32223
	ServicePort       = common.RegistryFacadeServicePort
	DockerUpImage     = "docker-up"
	WorkspacekitImage = "workspacekit"
)
