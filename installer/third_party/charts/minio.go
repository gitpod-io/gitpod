// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	_ "embed"
)

// Imported from https://helm.min.io

//go:embed minio/Chart.yaml
var minioChart []byte

//go:embed minio/values.yaml
var minioValues []byte

func Minio() *Chart {
	return &Chart{
		Name:   "Minio",
		Chart:  minioChart,
		Values: minioValues,
	}
}
