// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var allowedServiceTypes = map[corev1.ServiceType]struct{}{
	corev1.ServiceTypeLoadBalancer: {},
	corev1.ServiceTypeClusterIP:    {},
	corev1.ServiceTypeNodePort:     {},
	corev1.ServiceTypeExternalName: {},
}

func service(ctx *common.RenderContext) ([]runtime.Object, error) {

	loadBalancerIP := ""
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.ProxyConfig != nil {
			if cfg.WebApp.ProxyConfig.StaticIP != "" {
				loadBalancerIP = cfg.WebApp.ProxyConfig.StaticIP
			}
		}
		return nil
	})

	serviceType := corev1.ServiceTypeLoadBalancer
	if ctx.Config.Components != nil && ctx.Config.Components.Proxy != nil && ctx.Config.Components.Proxy.Service != nil {
		st := ctx.Config.Components.Proxy.Service.ServiceType
		if st != nil {
			_, allowed := allowedServiceTypes[corev1.ServiceType(*st)]
			if allowed {
				serviceType = *st
			}
		}
	}

	var annotations map[string]string
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.ProxyConfig != nil {
			annotations = cfg.WebApp.ProxyConfig.ServiceAnnotations
		}
		return nil
	})

	ports := []common.ServicePort{
		{
			Name:          ContainerHTTPName,
			ContainerPort: ContainerHTTPPort,
			ServicePort:   ContainerHTTPPort,
		},
		{
			Name:          ContainerHTTPSName,
			ContainerPort: ContainerHTTPSPort,
			ServicePort:   ContainerHTTPSPort,
		},
		{
			Name:          baseserver.BuiltinMetricsPortName,
			ContainerPort: baseserver.BuiltinMetricsPort,
			ServicePort:   baseserver.BuiltinMetricsPort,
		},
		{
			Name:          ContainerAnalyticsName,
			ContainerPort: ContainerAnalyticsPort,
			ServicePort:   ContainerAnalyticsPort,
		},
		{
			Name:          ContainerConfigcatName,
			ContainerPort: ContainerConfigcatPort,
			ServicePort:   ContainerConfigcatPort,
		},
	}
	if ctx.Config.SSHGatewayHostKey != nil {
		ports = append(ports, common.ServicePort{
			Name:          ContainerSSHName,
			ContainerPort: ContainerSSHPort,
			ServicePort:   ContainerSSHPort,
		})
	}

	return common.GenerateService(Component, ports, func(service *corev1.Service) {
		service.Spec.Type = serviceType
		if serviceType == corev1.ServiceTypeLoadBalancer {
			service.Spec.LoadBalancerIP = loadBalancerIP

			installationShortNameSuffix := ""
			if ctx.Config.Metadata.InstallationShortname != "" && ctx.Config.Metadata.InstallationShortname != configv1.InstallationShortNameOldDefault {
				installationShortNameSuffix = "-" + ctx.Config.Metadata.InstallationShortname
			}

			service.Annotations["external-dns.alpha.kubernetes.io/hostname"] = fmt.Sprintf("%s,*.%s,*.ws%s.%s", ctx.Config.Domain, ctx.Config.Domain, installationShortNameSuffix, ctx.Config.Domain)
			service.Annotations["cloud.google.com/neg"] = `{"exposed_ports": {"80":{},"443": {}}}`
		}

		for k, v := range annotations {
			service.Annotations[k] = v
		}
	})(ctx)
}
