// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package mysql

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func enabled(cfg *common.RenderContext) bool {
	return pointer.BoolDeref(cfg.Config.Database.InCluster, false)
}

var Objects = common.CompositeRenderFunc(
	configmap,
	secrets,
	service,
	common.CompositeRenderFunc(func(cfg *common.RenderContext) ([]runtime.Object, error) {
		if !enabled(cfg) {
			return nil, nil
		}

		return common.DefaultServiceAccount(Component)(cfg)
	}),
)
