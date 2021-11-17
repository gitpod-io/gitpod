// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package azure

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
)

var Helm = func(apiPort int32, consolePort int32) common.HelmFunc {
	return common.CompositeHelmFunc(
		helm.ImportTemplate(charts.Minio(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
			return &common.HelmConfig{
				Enabled: true,
				Values: &values.Options{
					Values: []string{
						helm.KeyValue("minio.gateway.enabled", "true"),
						helm.KeyValue("minio.gateway.auth.azure.accessKey", cfg.Values.StorageAccessKey), // Azure value actually taken from secret - used for console/API access
						helm.KeyValue("minio.gateway.auth.azure.secretKey", cfg.Values.StorageSecretKey), // Ditto
						helm.KeyValue("minio.gateway.auth.azure.storageAccountNameExistingSecret", cfg.Config.ObjectStorage.Azure.Credentials.Name),
						helm.KeyValue("minio.gateway.auth.azure.storageAccountNameExistingSecretKey", "accountName"),
						helm.KeyValue("minio.gateway.auth.azure.storageAccountKeyExistingSecret", cfg.Config.ObjectStorage.Azure.Credentials.Name),
						helm.KeyValue("minio.gateway.auth.azure.storageAccountKeyExistingSecretKey", "accountKey"),
						helm.KeyValue("minio.gateway.replicaCount", "2"),
						helm.KeyValue("minio.gateway.type", "azure"),
						helm.KeyValue("minio.persistence.enabled", "false"),
						helm.KeyValue("minio.service.ports.api", fmt.Sprintf("%d", apiPort)),
						helm.KeyValue("minio.service.ports.console", fmt.Sprintf("%d", consolePort)),
					},
				},
			}, nil
		}),
	)
}
