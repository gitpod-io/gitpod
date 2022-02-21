// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package openvsx_proxy

import "github.com/gitpod-io/gitpod/installer/pkg/common"

// todo(sje): conditionally deploy this component

var Objects = common.CompositeRenderFunc(
	configmap,
	networkpolicy,
	rolebinding,
	statefulset,
	common.GenerateService(Component, map[string]common.ServicePort{
		PortName: {
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
