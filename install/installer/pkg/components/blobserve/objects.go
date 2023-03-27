// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package blobserve

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	rolebinding,
	common.GenerateService(Component, []common.ServicePort{
		{
			Name:          ServicePortName,
			ContainerPort: ContainerPort,
			ServicePort:   ServicePort,
		},
		{
			Name:          baseserver.BuiltinMetricsPortName,
			ContainerPort: baseserver.BuiltinMetricsPort,
			ServicePort:   baseserver.BuiltinMetricsPort,
		},
	}),
	common.DefaultServiceAccount(Component),
)
