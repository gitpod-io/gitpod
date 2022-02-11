// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	"embed"
)

// Imported from https://github.com/bitnami/charts/tree/master/bitnami/mysql

//go:embed mysql/*
var mysql embed.FS

func MySQL() *Chart {
	return &Chart{
		Name:     "MySQL",
		Location: "mysql/",
		Content:  &mysql,
	}
}
