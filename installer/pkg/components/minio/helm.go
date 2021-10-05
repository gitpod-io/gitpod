// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package minio

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.Minio(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		accessKey, err := common.RandomString(20)
		if err != nil {
			return nil, err
		}
		secretKey, err := common.RandomString(20)
		if err != nil {
			return nil, err
		}

		return &common.HelmConfig{
			Enabled: *cfg.Config.ObjectStorage.InCluster,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("minio.accessKey", accessKey),
					helm.KeyValue("minio.secretKey", secretKey),
				},
			},
		}, nil
	}),
)
