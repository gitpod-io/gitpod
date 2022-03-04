// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dockerregistry

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

var Objects = common.CompositeRenderFunc(
	certificate,
	rolebinding,
	secret,
	func(ctx *common.RenderContext) ([]runtime.Object, error) {
		if !pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
			return nil, nil
		}

		return common.DefaultServiceAccount(Component)(ctx)
	},
)
