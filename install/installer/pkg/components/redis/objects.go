// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package redis

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	return common.CompositeRenderFunc(
		deployment,
		service,
		rolebinding,
		common.DefaultServiceAccount(Component),
		networkpolicy,
	)(ctx)
}

type Configuration struct {
	Address string `json:"address"`
}

func GetConfiguration(ctx *common.RenderContext) Configuration {
	return Configuration{
		Address: common.ClusterAddress(Component, ctx.Namespace, Port),
	}
}
