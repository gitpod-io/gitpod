// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package redis

const (
	Component = "redis"

	PortName = "api"
	Port     = 6379

	ContainerPrometheusPort  = 9090
	ContainterPrometheusName = "prometheus"

	RegistryRepo  = "registry.hub.docker.com"
	RegistryImage = "library/redis"
	ImageTag      = "7.0.8"

	ContainerName = "redis"
)
