// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package minio

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
	"k8s.io/utils/pointer"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.Minio(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		accessKey := cfg.Values.StorageAccessKey
		if accessKey == "" {
			return nil, fmt.Errorf("unknown value: storage access key")
		}
		secretKey := cfg.Values.StorageSecretKey
		if secretKey == "" {
			return nil, fmt.Errorf("unknown value: storage secret key")
		}

		return &common.HelmConfig{
			Enabled: pointer.BoolDeref(cfg.Config.ObjectStorage.InCluster, false),
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("minio.accessKey", accessKey),
					helm.KeyValue("minio.secretKey", secretKey),
					helm.KeyValue("service.port", fmt.Sprintf("%d", ServicePort)),
				},
			},
		}, nil
	}),
)
