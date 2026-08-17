// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package redis

const (
	Component = "redis"

	PortName = "api"
	Port     = 6379

	RegistryRepo  = "cgr.dev"
	RegistryImage = "chainguard/redis"

	ContainerName = "redis"
	ImageDigest   = "sha256:5317cd86cb36e19f8635886cc2134aa7cf73a791ec8696498599e862a6582d46"

	ExporterRegistryRepo  = "quay.io"
	ExporterRegistryImage = "oliver006/redis_exporter"
	ExporterImageDigest   = "sha256:23bef6c31e3b46c4157b57d74d75f651ac6e041f0231e35851a9098ee6c26d6e"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
