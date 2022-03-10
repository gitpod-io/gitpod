// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	rolebinding,
	func(cfg *common.RenderContext) ([]runtime.Object, error) {
		ports := map[string]common.ServicePort{
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
		}
		if cfg.Config.SSHGatewayHostKey != nil {
			ports[ContainerSSHName] = common.ServicePort{
				ContainerPort: ContainerSSHPort,
				ServicePort:   ContainerSSHPort,
			}
		}
		return common.GenerateService(Component, ports, func(service *corev1.Service) {
			service.Spec.Type = corev1.ServiceTypeLoadBalancer
			service.Annotations["external-dns.alpha.kubernetes.io/hostname"] = fmt.Sprintf("%s,*.%s,*.ws.%s", cfg.Config.Domain, cfg.Config.Domain, cfg.Config.Domain)
			service.Annotations["cloud.google.com/neg"] = `{"exposed_ports": {"80":{},"443": {}}}`
		})(cfg)
	},
	common.DefaultServiceAccount(Component),
)
