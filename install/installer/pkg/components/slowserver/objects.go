// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package slowserver

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
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
			Name:          baseserver.BuiltinMetricsPortName,
			ContainerPort: baseserver.BuiltinMetricsPort,
			ServicePort:   baseserver.BuiltinMetricsPort,
		},
		{
			Name:          InstallationAdminName,
			ContainerPort: InstallationAdminPort,
			ServicePort:   InstallationAdminPort,
		},
		{
			Name:          DebugPortName,
			ContainerPort: baseserver.BuiltinDebugPort,
			ServicePort:   baseserver.BuiltinDebugPort,
		},
		{
			Name:          DebugNodePortName,
			ContainerPort: common.DebugNodePort,
			ServicePort:   common.DebugNodePort,
		},
	}),
	common.DefaultServiceAccount(Component),
)
