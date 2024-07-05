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
	ImageDigest   = "sha256:867d4c7af0698defb49054beba82cf3d1bf5714d6a3872ea0d87b0b86a64817d"

	ExporterRegistryImage = "chainguard/prometheus-redis-exporter"
	ExporterImageDigest   = "sha256:09bfa3552d2349b115bbe74614f94fcb3c81ddcb6c6c23224654d8baabbc71e6"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
