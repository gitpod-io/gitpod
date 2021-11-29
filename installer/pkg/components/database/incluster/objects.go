// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package incluster

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	rolebinding,
	secrets,
	service,
	common.DefaultServiceAccount(Component),
	rolebinding,
)
