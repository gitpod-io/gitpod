// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package database

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/database/cloudsqlproxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/database/mysql"
)

var Objects = common.CompositeRenderFunc(
	mysql.Objects,
	cloudsqlproxy.Objects,
)

var Helm = common.CompositeHelmFunc(
	mysql.Helm,
)
