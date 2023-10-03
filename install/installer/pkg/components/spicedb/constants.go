// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

const (
	Component = "spicedb"

	ContainerHTTPPort = 8443
	ContainerHTTPName = "http"

	ContainerGRPCPort = 50051
	ContainerGRPCName = "grpc"

	ContainerDashboardPort = 8080
	ContainerDashboardName = "dashboard"

	ContainerDispatchPort = 50053
	ContainerDispatchName = "dispatch"

	ContainerPrometheusPort  = 9090
	ContainterPrometheusName = "prometheus"

	RegistryRepo  = "registry.hub.docker.com"
	RegistryImage = "authzed/spicedb"
	ImageTag      = "v1.22.2"

	ContainerName = "spicedb"

	CloudSQLProxyPort = 3306

	SecretPresharedKeyName = "presharedKey"
	BootstrapConfigMapName = "spicedb-bootstrap"
)
