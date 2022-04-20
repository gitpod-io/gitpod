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
	"sigs.k8s.io/yaml"
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

		backupCmd, err := yaml.Marshal([]string{
			"/bin/bash",
			"-c",
			"mysqldump -d \"${MYSQL_DATABASE}\" -u \"root\" -p\"${MYSQL_ROOT_PASSWORD}\" -h 127.0.0.1 > /scratch/backup.sql",
		})
		if err != nil {
			return nil, err
		}

		backupCmdTemplate, err := helm.KeyFileValue("mysql.primary.podAnnotations.pre\\.hook\\.backup\\.velero\\.io/command", backupCmd)
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
					helm.KeyValue("mysql.image.registry", ""),
					helm.KeyValue("mysql.image.repository", cfg.RepoName(common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL), "bitnami/mysql")),
					helm.ImagePullSecrets("mysql.metrics.image.pullSecrets", cfg),
					helm.KeyValue("mysql.metrics.image.registry", ""),
					helm.KeyValue("mysql.metrics.image.repository", cfg.RepoName(common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL), "bitnami/mysqld-exporter")),
					helm.ImagePullSecrets("mysql.volumePermissions.image.pullSecrets", cfg),
					helm.KeyValue("mysql.volumePermissions.image.pullPolicy", "IfNotPresent"),
					helm.KeyValue("mysql.volumePermissions.image.registry", ""),
					helm.KeyValue("mysql.volumePermissions.image.repository", cfg.RepoName(common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL), "bitnami/bitnami-shell")),

					// improve start time
					helm.KeyValue("mysql.primary.startupProbe.enabled", "false"),
					helm.KeyValue("mysql.primary.livenessProbe.initialDelaySeconds", "30"),

					// Configure KOTS backup
					helm.KeyValue("mysql.primary.podAnnotations.backup\\.velero\\.io/backup-volumes", "backup"),
					helm.KeyValue("mysql.primary.podAnnotations.pre\\.hook\\.backup\\.velero\\.io/timeout", "5m"),
					helm.KeyValue("mysql.primary.extraVolumes[0].name", "backup"),
					helm.KeyValue("mysql.primary.extraVolumeMounts[0].name", "backup"),
					helm.KeyValue("mysql.primary.extraVolumeMounts[0].mountPath", "/scratch"),
				},
				// This is too complex to be sent as a string
				FileValues: []string{
					primaryAffinityTemplate,
					backupCmdTemplate,
				},
			},
		}, nil
	}),
)
