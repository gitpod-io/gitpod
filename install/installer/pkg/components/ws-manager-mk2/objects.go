// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagermk2

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects common.RenderFunc = func(cfg *common.RenderContext) ([]runtime.Object, error) {
	var useMk2 bool
	_ = cfg.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace != nil {
			useMk2 = ucfg.Workspace.UseWsmanagerMk2
		}
		return nil
	})
	if !useMk2 {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		namespace,
		crd,
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
	)(cfg)
}
