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
	ImageDigest   = "sha256:18ad7cca222d9597f638fe18da11bf942624b4b0e7512c063897df5c135893db"

	ExporterRegistryRepo  = "quay.io"
	ExporterRegistryImage = "oliver006/redis_exporter"
	ExporterImageDigest   = "sha256:a79f49155ebede01477eb5a02495d1f304d693403fd33f5388ab2e57aaad0a1e"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
