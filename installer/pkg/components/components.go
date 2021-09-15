// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package components

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	registryfacade "github.com/gitpod-io/gitpod/installer/pkg/components/registry-facade"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	wsproxy "github.com/gitpod-io/gitpod/installer/pkg/components/ws-proxy"
	wsscheduler "github.com/gitpod-io/gitpod/installer/pkg/components/ws-scheduler"
)

var MetaObjects = common.CompositeRenderFunc()

var WorkspaceObjects = common.CompositeRenderFunc(
	wsdaemon.Objects,
	wsmanager.Objects,
	wsproxy.Objects,
	wsscheduler.Objects,
	registryfacade.Objects,
)

var FullObjects = common.CompositeRenderFunc(
	MetaObjects,
	WorkspaceObjects,
)
