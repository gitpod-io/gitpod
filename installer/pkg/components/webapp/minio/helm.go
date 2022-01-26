// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Minio is used for both in-cluster deployments and as a facade for non-GCP storage providers

package minio

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/minio/azure"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/minio/incluster"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"k8s.io/utils/pointer"
)

var Helm = common.CompositeHelmFunc(
	func(cfg *common.RenderContext) ([]string, error) {
		commonHelmValues := []string{
			helm.ImagePullSecrets("minio.image.pullSecrets", cfg),
			helm.KeyValue("minio.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),
			helm.ImagePullSecrets("minio.volumePermissions.image.pullSecrets", cfg),
			helm.KeyValue("minio.volumePermissions.image.registry", common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)),
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
