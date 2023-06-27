// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package redis

import "github.com/opencontainers/go-digest"

const (
	Component = "redis"

	PortName = "api"
	Port     = 6379

	RegistryRepo  = "cgr.dev"
	RegistryImage = "chainguard/redis"

	ContainerName = "redis"

	ExporterRegistryImage = "chainguard/prometheus-redis-exporter"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)

var (
	ImageDigest         = digest.FromString("sha256:d2802dec2f97b47c7fb34eee0b4d658fd0574577271e5e426e2d949cc3d47110")
	ExporterImageDigest = digest.FromString("sha256:30948f2fe1bee4bd13d33061f0abbbd1d045b69ec4e02b6213af8709ea7bb710")
)
