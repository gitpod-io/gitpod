// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Logically, this package belongs to the server component. However,
// from an ownership sense, this package belongs to a different team
// to the server so it's separated out

package ide

import "github.com/gitpod-io/gitpod/installer/pkg/common"

var Objects = common.CompositeRenderFunc(
	configmap,
)
