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
	ImageDigest   = "sha256:f79af849bd079fcaf883388c3005efc0bf25e8780720a6ebcb1863380c26c5ff"

	ExporterRegistryRepo  = "quay.io"
	ExporterRegistryImage = "oliver006/redis_exporter"
	ExporterImageDigest   = "sha256:d3fa08bdd9bd3689dcbd8108fb1a962a6aa502af86a25b1988f0863116c7505e"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
