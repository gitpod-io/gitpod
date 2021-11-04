// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dockerregistry

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
	"k8s.io/utils/pointer"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.DockerRegistry(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		secretHash, err := common.ObjectHash(common.DockerRegistryHash(cfg))
		if err != nil {
			return nil, err
		}

		return &common.HelmConfig{
			Enabled: pointer.BoolDeref(cfg.Config.ContainerRegistry.InCluster, false),
			Values: &values.Options{
				Values: []string{
					helm.KeyValue(fmt.Sprintf("docker-registry.podAnnotations.%s", strings.Replace(common.AnnotationConfigChecksum, ".", "\\.", -1)), secretHash),
					helm.KeyValue("docker-registry.fullnameOverride", RegistryName),
					helm.KeyValue("docker-registry.service.port", strconv.Itoa(common.ProxyContainerHTTPSPort)),
					helm.KeyValue("docker-registry.tlsSecretName", BuiltInRegistryCerts),
				},
			},
		}, nil
	}),
)
