// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Minio is used for both in-cluster deployments and as a facade for non-GCP storage providers

package minio

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/minio/azure"
	"github.com/gitpod-io/gitpod/installer/pkg/components/minio/incluster"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/utils/pointer"
)

var Helm = common.CompositeHelmFunc(
	func(cfg *common.RenderContext) ([]string, error) {
		imageRegistry := common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)

		commonHelmValues := []string{
			helm.ImagePullSecrets("minio.image.pullSecrets", cfg),
			helm.KeyValue("minio.image.registry", imageRegistry),
			helm.ImagePullSecrets("minio.volumePermissions.image.pullSecrets", cfg),
			helm.KeyValue("minio.volumePermissions.image.registry", imageRegistry),
		}

		if cfg.Config.ObjectStorage.Resources != nil && cfg.Config.ObjectStorage.Resources.Requests.Memory() != nil {
			memoryRequests := resource.MustParse(cfg.Config.ObjectStorage.Resources.Requests.Memory().String())
			commonHelmValues = append(commonHelmValues, helm.KeyValue("minio.resources.requests.memory", memoryRequests.String()))
		}

		if pointer.BoolDeref(cfg.Config.ObjectStorage.InCluster, false) {
			return incluster.Helm(ServiceAPIPort, ServiceConsolePort, commonHelmValues)(cfg)
		}
		if cfg.Config.ObjectStorage.Azure != nil {
			return azure.Helm(ServiceAPIPort, ServiceConsolePort, commonHelmValues)(cfg)
		}

		return nil, nil
	},
)
