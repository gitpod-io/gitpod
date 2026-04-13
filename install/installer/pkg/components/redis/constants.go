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
	ImageDigest   = "sha256:4dccb8397b70e9474f6d9700f4ca26d12a3ce4e831fc1fcff124e89bbec5175c"

	ExporterRegistryRepo  = "quay.io"
	ExporterRegistryImage = "oliver006/redis_exporter"
	ExporterImageDigest   = "sha256:4b467f718ea9f62fe47b87ce39039ebeedff7764c40fde2a129913484fff716f"

	ExporterContainerName = "exporter"
	ExporterPortName      = "exporter"
	ExporterPort          = 9500
)
