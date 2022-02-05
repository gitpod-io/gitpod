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

var HelmMySQL = common.CompositeHelmFunc(
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

var HelmMariaDB = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.MariaDB(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		affinity, err := helm.AffinityYaml(cluster.AffinityLabelMeta)
		if err != nil {
			return nil, err
		}

		primaryAffinityTemplate, err := helm.KeyFileValue("mariadb.primary.affinity", affinity)
		if err != nil {
			return nil, err
		}

		return &common.HelmConfig{
			Enabled: true,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("mariadb.auth.existingSecret", SQLPasswordName),
					helm.KeyValue("mariadb.auth.database", Database),
					helm.KeyValue("mariadb.auth.username", Username),
					helm.KeyValue("mariadb.initdbScriptsConfigMap", SQLInitScripts),
					helm.KeyValue("mariadb.serviceAccount.name", Component),
					helm.ImagePullSecrets("mariadb.image.pullSecrets", cfg),
					helm.KeyValue("mariadb.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),
					helm.ImagePullSecrets("mariadb.metrics.image.pullSecrets", cfg),
					helm.KeyValue("mariadb.metrics.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),
					helm.ImagePullSecrets("mariadb.volumePermissions.image.pullSecrets", cfg),
					helm.KeyValue("mariadb.volumePermissions.image.pullPolicy", "IfNotPresent"),
					helm.KeyValue("mariadb.volumePermissions.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),
					// Disable ipv6 by setting bind-address=0.0.0.0
					helm.KeyValue("mariadb.primary.configuration",
						`
[mysqld]
skip-name-resolve
explicit_defaults_for_timestamp
basedir=/opt/bitnami/mariadb
plugin_dir=/opt/bitnami/mariadb/plugin
port=3306
socket=/opt/bitnami/mariadb/tmp/mysql.sock
tmpdir=/opt/bitnami/mariadb/tmp
max_allowed_packet=16M
bind-address=0.0.0.0
pid-file=/opt/bitnami/mariadb/tmp/mysqld.pid
log-error=/opt/bitnami/mariadb/logs/mysqld.log
character-set-server=UTF8
collation-server=utf8_general_ci

[client]
port=3306
socket=/opt/bitnami/mariadb/tmp/mysql.sock
default-character-set=UTF8
plugin_dir=/opt/bitnami/mariadb/plugin

[manager]
port=3306
socket=/opt/bitnami/mariadb/tmp/mysql.sock
pid-file=/opt/bitnami/mariadb/tmp/mysqld.pid
`),
					// improve start time
					helm.KeyValue("mariadb.primary.startupProbe.enabled", "false"),
					helm.KeyValue("mariadb.primary.livenessProbe.initialDelaySeconds", "30"),
				},
				// This is too complex to be sent as a string
				FileValues: []string{
					primaryAffinityTemplate,
				},
			},
		}, nil
	}),
)
