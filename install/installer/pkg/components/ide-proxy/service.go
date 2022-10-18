// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide_proxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	var annotations map[string]string
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.IDE != nil && cfg.IDE.IDEProxyConfig != nil {
			annotations = cfg.IDE.IDEProxyConfig.ServiceAnnotations
		}
		return nil
	})

	ports := []common.ServicePort{
		{
			Name:          PortName,
			ContainerPort: ContainerPort,
			ServicePort:   ServicePort,
		},
	}

	return common.GenerateService(Component, ports, func(service *corev1.Service) {
		for k, v := range annotations {
			service.Annotations[k] = v
		}
	})(ctx)
}
