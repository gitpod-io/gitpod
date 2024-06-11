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
	ImageDigest   = "sha256:faafcc4f149997127c3402565fcaf018980e2a1803ef0ef2256ee6b11c1972b9"

	ExporterRegistryImage = "chainguard/prometheus-redis-exporter"
	ExporterImageDigest   = "sha256:ca22acb4dd6046bec280361a7ad262fee8d69a5beb7dc1ea2f9009f53b0773b5"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
