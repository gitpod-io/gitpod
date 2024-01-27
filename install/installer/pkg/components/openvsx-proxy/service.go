// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package openvsx_proxy

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	var annotations map[string]string

	if ctx.Config.OpenVSX.Proxy != nil {
		annotations = ctx.Config.OpenVSX.Proxy.ServiceAnnotations
	}

	ports := []common.ServicePort{
		{
			Name:          PortName,
			ContainerPort: ContainerPort,
			ServicePort:   ServicePort,
		},
		{
			Name:          baseserver.BuiltinMetricsPortName,
			ContainerPort: baseserver.BuiltinMetricsPort,
			ServicePort:   baseserver.BuiltinMetricsPort,
		},
	}

	return common.GenerateService(Component, ports, func(service *corev1.Service) {
		for k, v := range annotations {
			service.Annotations[k] = v
		}
	})(ctx)
}
