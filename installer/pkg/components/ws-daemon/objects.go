// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsdaemon

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	clusterrole,
	configmap,
	common.DefaultServiceAccount(Component),
	daemonset,
	networkpolicy,
	rolebinding,
	common.GenerateService(Component),
	tlssecret,
)
