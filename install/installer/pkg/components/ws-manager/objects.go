// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	role,
	rolebinding,
	common.DefaultServiceAccount(Component),
	common.GenerateService(Component, []common.ServicePort{
		{
			Name:          RPCPortName,
			ContainerPort: RPCPort,
			ServicePort:   RPCPort,
		},
	}),
	tlssecret,
	unprivilegedRolebinding,
)
