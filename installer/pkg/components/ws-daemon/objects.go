// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsdaemon

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const component = "ws-daemon"

var Objects = common.CompositeRenderFunc(
	clusterrole,
	configmap,
	common.DefaultServiceAccount(component),
	daemonset,
	networkpolicy,
	rolebinding,
	common.GenerateService(component),
	tlssecret,
)
