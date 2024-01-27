// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package componentsworkspace

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	agentsmith "github.com/gitpod-io/gitpod/installer/pkg/components/agent-smith"
	imagebuildermk3 "github.com/gitpod-io/gitpod/installer/pkg/components/image-builder-mk3"
	nodelabeler "github.com/gitpod-io/gitpod/installer/pkg/components/node-labeler"
	registryfacade "github.com/gitpod-io/gitpod/installer/pkg/components/registry-facade"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"
	wsproxy "github.com/gitpod-io/gitpod/installer/pkg/components/ws-proxy"
)

var Objects = common.CompositeRenderFunc(
	agentsmith.Objects,
	registryfacade.Objects,
	workspace.Objects,
	wsdaemon.Objects,
	wsproxy.Objects,
	imagebuildermk3.Objects,
	wsmanagermk2.Objects,
	nodelabeler.Objects,
)

var Helm = common.CompositeHelmFunc()
