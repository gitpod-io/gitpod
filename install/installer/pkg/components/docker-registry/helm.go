// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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

		repository := cfg.RepoName(common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL), "library/registry")

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

		// Append the custom parameters
		registryValues = helm.CustomizeAnnotation(registryValues, "docker-registry.podAnnotations", cfg, Component, common.TypeMetaDeployment)
		registryValues = helm.CustomizeLabel(registryValues, "docker-registry.podLabels", cfg, Component, common.TypeMetaDeployment)
		registryValues = helm.CustomizeAnnotation(registryValues, "docker-registry.service.annotations", cfg, Component, common.TypeMetaService)
		registryValues = helm.CustomizeEnvvar(registryValues, "docker-registry.extraEnvVars", cfg, Component)

		inCluster := pointer.BoolDeref(cfg.Config.ContainerRegistry.InCluster, false)
		s3Storage := cfg.Config.ContainerRegistry.S3Storage
		enablePersistence := "true"

		if inCluster && s3Storage != nil {
			enablePersistence = "false"
			registryValues = append(registryValues,
				helm.KeyValue("docker-registry.s3.region", s3Storage.Region),
				helm.KeyValue("docker-registry.s3.bucket", s3Storage.Bucket),
				helm.KeyValue("docker-registry.s3.regionEndpoint", s3Storage.Endpoint),
				helm.KeyValue("docker-registry.s3.encrypt", "true"),
				helm.KeyValue("docker-registry.s3.secure", "true"),
				helm.KeyValue("docker-registry.storage", "s3"),
				helm.KeyValue("docker-registry.secrets.s3.secretRef", s3Storage.Certificate.Name),
				helm.KeyValue("docker-registry.secrets.haSharedSecret", cfg.Values.InternalRegistrySharedSecret),
			)
		}

		registryValues = append(registryValues, helm.KeyValue("docker-registry.persistence.enabled", enablePersistence))

		return &common.HelmConfig{
			Enabled: inCluster,
			Values: &values.Options{
				Values: registryValues,
			},
		}, nil
	}),
)
