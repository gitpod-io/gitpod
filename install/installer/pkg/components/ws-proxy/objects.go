// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsproxy

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	rolebinding,
	role,
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
		return common.GenerateService(Component, ports, func(service *corev1.Service) {
			// In the case of Workspace only setup, `ws-proxy` service is the entrypoint
			// Hence we use LoadBalancer type for the service
			if cfg.Config.Kind == config.InstallationWorkspace {
				service.Spec.Type = corev1.ServiceTypeLoadBalancer
				service.Annotations["cloud.google.com/neg"] = `{"exposed_ports": {"80":{},"443": {}}}`
			}
		})(cfg)
	},
	common.DefaultServiceAccount(Component),
)
