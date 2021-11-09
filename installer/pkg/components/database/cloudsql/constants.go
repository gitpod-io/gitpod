// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cloudsql

const (
	Component       = "cloudsqlproxy"
	dbSessionsImage = "mysql"
	dbSessionsTag   = "5.7.34"
	ImageRepo       = "b.gcr.io/cloudsql-docker"
	ImageName       = "gce-proxy"
	ImageVersion    = "1.11"
	initScriptDir   = "init"
	Port            = 3306
	SQLInitScripts  = "db-init-scripts"
)
