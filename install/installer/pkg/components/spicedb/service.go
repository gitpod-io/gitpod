// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	return common.GenerateService(Component, []common.ServicePort{
		{
			Name:          ContainerGRPCName,
			ContainerPort: ContainerGRPCPort,
			ServicePort:   ContainerGRPCPort,
		},
		{
			Name:          ContainerHTTPName,
			ContainerPort: ContainerHTTPPort,
			ServicePort:   ContainerHTTPPort,
		},
		{
			Name:          ContainerDispatchName,
			ContainerPort: ContainerDispatchPort,
			ServicePort:   ContainerDispatchPort,
		},
	})(ctx)
}
