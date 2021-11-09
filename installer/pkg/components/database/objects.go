// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package database

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/database/cloudsql"
	"github.com/gitpod-io/gitpod/installer/pkg/components/database/incluster"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func cloudSqlEnabled(cfg *common.RenderContext) bool {
	return !pointer.BoolDeref(cfg.Config.Database.InCluster, false) && cfg.Config.Database.CloudSQL != nil
}

func inClusterEnabled(cfg *common.RenderContext) bool {
	return pointer.BoolDeref(cfg.Config.Database.InCluster, false)
}

var Objects = common.CompositeRenderFunc(
	common.CompositeRenderFunc(func(cfg *common.RenderContext) ([]runtime.Object, error) {
		if inClusterEnabled(cfg) {
			return incluster.Objects(cfg)
		}
		if cloudSqlEnabled(cfg) {
			return cloudsql.Objects(cfg)
		}
		return nil, nil
	}),
)

var Helm = common.CompositeHelmFunc(
	common.CompositeHelmFunc(func(cfg *common.RenderContext) ([]string, error) {
		if inClusterEnabled(cfg) {
			return incluster.Helm(cfg)
		}

		return nil, nil
	}),
)
