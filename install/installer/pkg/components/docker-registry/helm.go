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

		repository := fmt.Sprintf("%s/library/registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL))

		registryValues := []string{
			helm.KeyValue(fmt.Sprintf("docker-registry.podAnnotations.%s", strings.Replace(common.AnnotationConfigChecksum, ".", "\\.", -1)), secretHash),
			helm.KeyValue("docker-registry.fullnameOverride", RegistryName),
			helm.KeyValue("docker-registry.service.port", strconv.Itoa(common.ProxyContainerHTTPSPort)),
			helm.KeyValue("docker-registry.tlsSecretName", BuiltInRegistryCerts),
			helm.KeyValue("docker-registry.image.repository", repository),
			helm.KeyValue("docker-registry.serviceAccount.name", Component),
		}

		if len(cfg.Config.ImagePullSecrets) > 0 {
			// This chart doesn't add in the "name/value" pair format
			for k, v := range cfg.Config.ImagePullSecrets {
				registryValues = append(registryValues, helm.KeyValue(fmt.Sprintf("docker-registry.imagePullSecrets[%d].name", k), v.Name))
			}
		}

		inCluster := pointer.BoolDeref(cfg.Config.ContainerRegistry.InCluster, false)
		s3Storage := cfg.Config.ContainerRegistry.S3Storage

		if inCluster && s3Storage != nil {
			registryValues = append(registryValues,
				helm.KeyValue("docker-registry.s3.region", cfg.Config.Metadata.Region),
				helm.KeyValue("docker-registry.s3.bucket", s3Storage.Bucket),
				helm.KeyValue("docker-registry.s3.encrypt", "true"),
				helm.KeyValue("docker-registry.s3.secure", "true"),
				helm.KeyValue("docker-registry.storage", "s3"),
				helm.KeyValue("docker-registry.secrets.s3.secretRef", s3Storage.Certificate.Name),
			)
		}

		return &common.HelmConfig{
			Enabled: inCluster,
			Values: &values.Options{
				Values: registryValues,
			},
		}, nil
	}),
)
