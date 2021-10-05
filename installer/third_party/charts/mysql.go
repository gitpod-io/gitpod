// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	_ "embed"
)

// Imported from https://github.com/bitnami/charts/tree/master/bitnami/mysql

//go:embed mysql/Chart.yaml
var mysqlChart []byte

//go:embed mysql/values.yaml
var mysqlValues []byte

func MySQL() *Chart {
	return &Chart{
		Name:   "MySQL",
		Chart:  mysqlChart,
		Values: mysqlValues,
	}
}
