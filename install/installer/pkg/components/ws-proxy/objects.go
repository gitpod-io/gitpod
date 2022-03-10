// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	rolebinding,
	role,
	common.DefaultServiceAccount(Component),
	common.GenerateService(Component, map[string]common.ServicePort{
		HTTPProxyPortName: {
			ContainerPort: HTTPProxyPort,
			ServicePort:   HTTPProxyPort,
		},
		HTTPSProxyPortName: {
			ContainerPort: HTTPSProxyPort,
			ServicePort:   HTTPSProxyPort,
		},
		MetricsPortName: {
			ContainerPort: MetricsPort,
			ServicePort:   MetricsPort,
		},
		SSHPortName: {
			ContainerPort: SSHTargetPort,
			ServicePort:   SSHServicePort,
		},
	}),
)
