// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package incluster

import (
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.MySQL(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		affinity, err := helm.AffinityYaml(cluster.AffinityLabelMeta)
		if err != nil {
			return nil, err
		}

		primaryAffinityTemplate, err := helm.KeyFileValue("mysql.primary.affinity", affinity)
		if err != nil {
			return nil, err
		}

		return &common.HelmConfig{
			Enabled: true,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("mysql.auth.existingSecret", SQLPasswordName),
					helm.KeyValue("mysql.auth.database", Database),
					helm.KeyValue("mysql.auth.username", Username),
					helm.KeyValue("mysql.initdbScriptsConfigMap", SQLInitScripts),
					helm.KeyValue("mysql.serviceAccount.name", Component),
					helm.ImagePullSecrets("mysql.image.pullSecrets", cfg),
					helm.KeyValue("mysql.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),
					helm.ImagePullSecrets("mysql.metrics.image.pullSecrets", cfg),
					helm.KeyValue("mysql.metrics.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),
					helm.ImagePullSecrets("mysql.volumePermissions.image.pullSecrets", cfg),
					helm.KeyValue("mysql.volumePermissions.image.pullPolicy", "IfNotPresent"),
					helm.KeyValue("mysql.volumePermissions.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),

					// improve start time
					helm.KeyValue("mysql.primary.startupProbe.enabled", "false"),
					helm.KeyValue("mysql.primary.livenessProbe.initialDelaySeconds", "30"),
				},
				// This is too complex to be sent as a string
				FileValues: []string{
					primaryAffinityTemplate,
				},
			},
		}, nil
	}),
)
