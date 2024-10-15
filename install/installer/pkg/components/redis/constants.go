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
	ImageDigest   = "sha256:2aa856ea6962e92853a8c9620c5a3c5f1f380bf54c51c265d0dbb038f37f9a1b"

	ExporterRegistryImage = "chainguard/prometheus-redis-exporter"
	ExporterImageDigest   = "sha256:154e581b984808dfff7c3fc300c09e7a4f34cc8ab8be8341758578bb8397206a"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
