// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package incluster

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.MySQL(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		return &common.HelmConfig{
			Enabled: true,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("mysql.auth.existingSecret", SQLPasswordName),
					helm.KeyValue("mysql.auth.database", Database),
					helm.KeyValue("mysql.auth.username", Username),
					helm.KeyValue("mysql.initdbScriptsConfigMap", SQLInitScripts),
					helm.KeyValue("mysql.serviceAccount.name", Component),
				},
			},
		}, nil
	}),
)
