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

	ExporterRegistryImage = "oliver006/redis_exporter"
	ExporterImageTag      = "v1.48.0"
	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)

var (
	ImageDigest = digest.FromString("sha256:d2802dec2f97b47c7fb34eee0b4d658fd0574577271e5e426e2d949cc3d47110")
)
