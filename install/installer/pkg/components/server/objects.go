// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server/ide"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	ide.Objects,
	networkpolicy,
	role,
	rolebinding,
	common.GenerateService(Component, []common.ServicePort{
		{
			Name:          ContainerPortName,
			ContainerPort: ContainerPort,
			ServicePort:   ServicePort,
		},
		{
			Name:          PrometheusPortName,
			ContainerPort: PrometheusPort,
			ServicePort:   PrometheusPort,
		},
		{
			Name:          InstallationAdminName,
			ContainerPort: InstallationAdminPort,
			ServicePort:   InstallationAdminPort,
		},
		{
			Name:          DebugPortName,
			ContainerPort: common.DebugPort,
			ServicePort:   common.DebugPort,
		},
		{
			Name:          DebugNodePortName,
			ContainerPort: common.DebugNodePort,
			ServicePort:   common.DebugNodePort,
		},
	}),
	common.DefaultServiceAccount(Component),
)
