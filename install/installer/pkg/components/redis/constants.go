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
	ImageDigest   = "sha256:060acd978a5b70261dab92f898bfd2aafde5c419c3662ef100b5abe3831a670e"

	ExporterRegistryRepo  = "quay.io"
	ExporterRegistryImage = "oliver006/redis_exporter"
	ExporterImageDigest   = "sha256:9e19fc77b9c5cb138a9ec9335b8bbcbbed620c4df54f7eb29329cdd8db148f1d"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
