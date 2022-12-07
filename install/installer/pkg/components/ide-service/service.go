// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide_service

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	"k8s.io/apimachinery/pkg/runtime"
)

func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	ports := []common.ServicePort{
		{
			Name:          GRPCPortName,
			ContainerPort: GRPCServicePort,
			ServicePort:   GRPCServicePort,
		},
	}
	return common.GenerateService(Component, ports)(ctx)
}
