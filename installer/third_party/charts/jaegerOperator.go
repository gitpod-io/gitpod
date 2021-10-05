// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	_ "embed"
)

// Imported from https://github.com/jaegertracing/helm-charts/tree/main/charts/jaeger-operator

//go:embed jaeger-operator/Chart.yaml
var jaegerOperatorChart []byte

//go:embed jaeger-operator/values.yaml
var jaegerOperatorValues []byte

//go:embed jaeger-operator/crd.yaml
var jaegerOperatorCrd []byte

func JaegerOperator() *Chart {
	return &Chart{
		Name:   "jaeger-operator",
		Chart:  jaegerOperatorChart,
		Values: jaegerOperatorValues,
		KubeObjects: [][]byte{
			jaegerOperatorCrd,
		},
	}
}
