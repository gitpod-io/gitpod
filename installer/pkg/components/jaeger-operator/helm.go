// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package jaegeroperator

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.JaegerOperator(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		return &common.HelmConfig{
			Enabled: *cfg.Config.Jaeger.InCluster,
			Values: &values.Options{
				Values: []string{
					"installCRDs=true",
					"crd.install=false",
					"rbac.clusterRole=true",
				},
			},
		}, nil
	}),
)
