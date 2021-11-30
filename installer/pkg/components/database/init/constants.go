// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package init

const (
	Component       = "dbinit"
	dbSessionsImage = "library/mysql"
	dbSessionsTag   = "5.7.34"
	initScriptDir   = "files"
	sqlInitScripts  = "db-init-scripts"
)
