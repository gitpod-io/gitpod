// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package toxiproxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := common.ExperimentalWebappConfig(ctx)
	if cfg == nil || !cfg.SlowDatabase {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		deployment,
		service,
		configmap,
		common.DefaultServiceAccount(Component),
	)(ctx)
}
