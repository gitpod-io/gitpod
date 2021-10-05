// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package mysql

import "github.com/gitpod-io/gitpod/installer/pkg/common"

const (
	Component         = "mysql"
	InClusterDbSecret = common.InClusterDbSecret
	SQLInitScripts    = "db-init-scripts"
	SQLPasswordName   = "db-password"
)
