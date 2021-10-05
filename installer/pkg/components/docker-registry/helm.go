// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dockerregistry

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
	"strconv"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.DockerRegistry(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		return &common.HelmConfig{
			Enabled: *cfg.Config.ContainerRegistry.InCluster,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("docker-registry.service.port", strconv.Itoa(proxy.ContainerHTTPSPort)),
					helm.KeyValue("docker-registry.tlsSecretName", proxy.RegistryTLSCertSecret),
				},
			},
		}, nil
	}),
)
