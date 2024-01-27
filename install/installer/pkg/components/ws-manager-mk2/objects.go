// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagermk2

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects common.RenderFunc = func(cfg *common.RenderContext) ([]runtime.Object, error) {
	return common.CompositeRenderFunc(
		namespace,
		crd,
		configmap,
		deployment,
		pdb,
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
