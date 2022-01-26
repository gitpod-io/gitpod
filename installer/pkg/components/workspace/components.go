// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	agentsmith "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/agent-smith"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace/blobserve"
	registryfacade "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/registry-facade"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ws-daemon"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ws-manager"
	wsproxy "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ws-proxy"
)

var Objects = common.CompositeRenderFunc(
	agentsmith.Objects,
	blobserve.Objects,
	registryfacade.Objects,
	wsdaemon.Objects,
	wsmanager.Objects,
	wsproxy.Objects,
	objects,
)

var objects = common.CompositeRenderFunc(
	networkpolicy,
	podsecuritypolicies,
	role,
	rolebinding,
	common.DefaultServiceAccount("workspace"),
)

var HelmDependencies = common.CompositeHelmFunc()
