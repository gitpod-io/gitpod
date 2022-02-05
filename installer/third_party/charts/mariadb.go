// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	"embed"
)

// Imported from https://github.com/bitnami/charts/tree/master/bitnami/mariadb

//go:embed mariadb/*
var mariadb embed.FS

func MariaDB() *Chart {
	return &Chart{
		Name:     "MariaDB",
		Location: "mariadb/",
		Content:  &mariadb,
	}
}
