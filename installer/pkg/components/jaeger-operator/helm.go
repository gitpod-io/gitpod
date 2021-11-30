// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package jaegeroperator

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
	"k8s.io/utils/pointer"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.JaegerOperator(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		repository := common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)
		image := "jaegertracing/jaeger-operator"

		return &common.HelmConfig{
			Enabled: pointer.BoolDeref(cfg.Config.Jaeger.InCluster, false),
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("jaeger-operator.crd.install", "true"),
					helm.KeyValue("jaeger-operator.rbac.clusterRole", "true"),
					helm.ImagePullSecrets("jaeger-operator.image.imagePullSecrets", cfg),
					helm.KeyValue("jaeger-operator.image.repository", fmt.Sprintf("%s/%s", repository, image)),
				},
			},
		}, nil
	}),
)
