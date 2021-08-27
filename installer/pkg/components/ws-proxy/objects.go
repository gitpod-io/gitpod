// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

import "github.com/gitpod-io/gitpod/installer/pkg/common"

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	rolebinding,
	common.DefaultServiceAccount(Component),
	common.GenerateService(Component, map[string]common.ServicePort{
		"httpProxy": {
			ContainerPort: HTTPProxyPort,
			ServicePort:   HTTPProxyPort,
		},
		"httpsProxy": {
			ContainerPort: HTTPSProxyPort,
			ServicePort:   HTTPSProxyPort,
		},
		"metrics": {
			ContainerPort: MetricsPort,
			ServicePort:   MetricsPort,
		},
	}, nil),
)
