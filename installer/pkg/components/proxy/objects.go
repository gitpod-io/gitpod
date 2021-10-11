// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import "github.com/gitpod-io/gitpod/installer/pkg/common"

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	rolebinding,
	common.GenerateService(Component, map[string]common.ServicePort{
		ContainerHTTPName: {
			ContainerPort: ContainerHTTPPort,
			ServicePort:   ContainerHTTPPort,
		},
		ContainerHTTPSName: {
			ContainerPort: ContainerHTTPSPort,
			ServicePort:   ContainerHTTPSPort,
		},
		MetricsContainerName: {
			ContainerPort: PrometheusPort,
			ServicePort:   PrometheusPort,
		},
	}, nil),
	common.DefaultServiceAccount(Component),
)
