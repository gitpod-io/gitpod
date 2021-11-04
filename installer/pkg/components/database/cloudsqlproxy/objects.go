// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cloudsqlproxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects common.RenderFunc = func(ctx *common.RenderContext) ([]runtime.Object, error) {
	if ctx.Config.Database.CloudSQL == nil {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		rolebinding,
		deployment,
		service,
		common.DefaultServiceAccount(Component),
	)(ctx)
}
