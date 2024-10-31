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
	ImageDigest   = "sha256:14aa8dfea26750ab0b659e6dab364c6f62d11cdcd9dcbe8a8cb376fc4416d958"

	ExporterRegistryImage = "chainguard/prometheus-redis-exporter"
	ExporterImageDigest   = "sha256:d3ddb25bf7bec9bb898aa4712413182e2699bef5ad7a6cf1dfcd02bc84cf8951"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
