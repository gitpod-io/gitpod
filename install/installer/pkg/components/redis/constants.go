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
	ImageDigest   = "sha256:3b0befd4b4a9c2aff6d043e316a1e9f8c087e5a6c552982a6dcdbdcc1d46b07e"

	ExporterRegistryImage = "chainguard/prometheus-redis-exporter"
	ExporterImageDigest   = "sha256:86b0c0dd2daaea55df5b65c6983b143ae2fc00d07834ff07f8eeb3006d4a96c1"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
