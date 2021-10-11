// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import "github.com/gitpod-io/gitpod/installer/pkg/common"

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	rolebinding,
	common.GenerateService(Component, map[string]common.ServicePort{
		ServicePortName: {
			ContainerPort: ContainerPort,
			ServicePort:   ServicePort,
		},
	}, nil),
	common.DefaultServiceAccount(Component),
)
