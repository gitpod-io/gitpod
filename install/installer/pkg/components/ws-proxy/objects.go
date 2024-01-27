// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsproxy

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	rolebinding,
	role,
	pdb,
	func(cfg *common.RenderContext) ([]runtime.Object, error) {
		ports := []common.ServicePort{
			{
				Name:          HTTPProxyPortName,
				ContainerPort: HTTPProxyTargetPort,
				ServicePort:   HTTPProxyPort,
			},
			{
				Name:          HTTPSProxyPortName,
				ContainerPort: HTTPSProxyTargetPort,
				ServicePort:   HTTPSProxyPort,
			},
			{
				Name:          baseserver.BuiltinMetricsPortName,
				ContainerPort: baseserver.BuiltinMetricsPort,
				ServicePort:   baseserver.BuiltinMetricsPort,
			},
			{
				Name:          SSHPortName,
				ContainerPort: SSHTargetPort,
				ServicePort:   SSHServicePort,
			},
		}
		return common.GenerateService(Component, ports)(cfg)
	},
	common.DefaultServiceAccount(Component),
)
