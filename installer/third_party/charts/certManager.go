// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	_ "embed"
)

// Imported from https://cert-manager.io/docs/installation/helm/

//go:embed cert-manager/Chart.yaml
var certManagerChart []byte

//go:embed cert-manager/values.yaml
var certManagerValues []byte

func CertManager() *Chart {
	return &Chart{
		Name:   "cert-manager",
		Chart:  certManagerChart,
		Values: certManagerValues,
	}
}
