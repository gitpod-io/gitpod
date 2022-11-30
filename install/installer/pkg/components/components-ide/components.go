// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package componentside

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/blobserve"
	ide_metrics "github.com/gitpod-io/gitpod/installer/pkg/components/ide-metrics"
	ide_proxy "github.com/gitpod-io/gitpod/installer/pkg/components/ide-proxy"
	ide_service "github.com/gitpod-io/gitpod/installer/pkg/components/ide-service"
	openvsxproxy "github.com/gitpod-io/gitpod/installer/pkg/components/openvsx-proxy"
	wsproxy "github.com/gitpod-io/gitpod/installer/pkg/components/ws-proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects = common.CompositeRenderFunc(
	blobserve.Objects,
	ide_metrics.Objects,
	ide_service.Objects,
	ide_proxy.Objects,
	openvsxproxy.Objects,
	func(cfg *common.RenderContext) ([]runtime.Object, error) {
		if cfg.Config.Kind == config.InstallationFull {
			// ws-proxy is already included by WorkspaceComponents in a full installation.
			return nil, nil
		}
		return wsproxy.Objects(cfg)
	},
)

var Helm = common.CompositeHelmFunc()
