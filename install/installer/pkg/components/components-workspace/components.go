// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package componentsworkspace

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	agentsmith "github.com/gitpod-io/gitpod/installer/pkg/components/agent-smith"
	imagebuildermk3 "github.com/gitpod-io/gitpod/installer/pkg/components/image-builder-mk3"
	registrycredential "github.com/gitpod-io/gitpod/installer/pkg/components/registry-credential"
	registryfacade "github.com/gitpod-io/gitpod/installer/pkg/components/registry-facade"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	wsproxy "github.com/gitpod-io/gitpod/installer/pkg/components/ws-proxy"
)

var Objects = common.CompositeRenderFunc(
	agentsmith.Objects,
	registryfacade.Objects,
	workspace.Objects,
	wsdaemon.Objects,
	wsmanager.Objects,
	wsproxy.Objects,
	imagebuildermk3.Objects,
	registrycredential.Objects,
)

var Helm = common.CompositeHelmFunc()
