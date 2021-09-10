// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const component = "ws-manager"

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	networkpolicy,
	role,
	rolebinding,
	common.DefaultServiceAccount(component),
	common.GenerateService(component),
	tlssecret,
	unprivilegedRolebinding,
)
