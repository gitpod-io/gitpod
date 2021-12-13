// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server/ide"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
)

func getComponentConfig(ctx *common.RenderContext) *config.ServerComponent {
	if ctx.Config.Components != nil && ctx.Config.Components.Server != nil {
		return ctx.Config.Components.Server
	}

	return nil
}

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	ide.Objects,
	networkpolicy,
	role,
	rolebinding,
	common.GenerateService(Component, map[string]common.ServicePort{
		ContainerPortName: {
			ContainerPort: ContainerPort,
			ServicePort:   ServicePort,
		},
		PrometheusPortName: {
			ContainerPort: PrometheusPort,
			ServicePort:   PrometheusPort,
		},
	}),
	common.DefaultServiceAccount(Component),
)
