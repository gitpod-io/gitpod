// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package incluster

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/utils/pointer"
)

func inClusterEnabled(cfg *common.RenderContext) bool {
	return pointer.BoolDeref(cfg.Config.Database.InCluster, false)
}

func useMariaDB(cfg *common.RenderContext) bool {
	return pointer.BoolDeref(cfg.Config.Database.MariaDB, false)
}

var Objects = common.CompositeRenderFunc(
	configmap,
	rolebinding,
	secrets,
	service,
	common.DefaultServiceAccount(Component),
)
