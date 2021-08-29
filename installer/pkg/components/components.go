// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package components

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
)

var MetaObjects = common.CompositeRendeFunc()

var WorkspaceObjects = common.CompositeRendeFunc(
	wsdaemon.Objects,
)

var FullObjects = common.CompositeRendeFunc(
	MetaObjects,
	WorkspaceObjects,
)
