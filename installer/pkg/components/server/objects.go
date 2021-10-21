// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	ideconfigmap,
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
