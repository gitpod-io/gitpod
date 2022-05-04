// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	loadBalancerIP := ""
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.ProxyConfig != nil && cfg.WebApp.ProxyConfig.StaticIP != "" {
			loadBalancerIP = cfg.WebApp.ProxyConfig.StaticIP
		}
		return nil
	})

	var annotations map[string]string
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.ProxyConfig != nil {
			annotations = cfg.WebApp.ProxyConfig.ServiceAnnotations
		}
		return nil
	})

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
	if ctx.Config.SSHGatewayHostKey != nil {
		ports[ContainerSSHName] = common.ServicePort{
			ContainerPort: ContainerSSHPort,
			ServicePort:   ContainerSSHPort,
		}
	}

	return common.GenerateService(Component, ports, func(service *corev1.Service) {
		service.Spec.Type = corev1.ServiceTypeLoadBalancer
		service.Spec.LoadBalancerIP = loadBalancerIP

		service.Annotations["external-dns.alpha.kubernetes.io/hostname"] = fmt.Sprintf("%s,*.%s,*.ws.%s", ctx.Config.Domain, ctx.Config.Domain, ctx.Config.Domain)
		service.Annotations["cloud.google.com/neg"] = `{"exposed_ports": {"80":{},"443": {}}}`

		for k, v := range annotations {
			service.Annotations[k] = v
		}
	})(ctx)
}
