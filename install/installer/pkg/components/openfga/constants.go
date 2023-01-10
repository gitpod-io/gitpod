// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package openfga

const (
	Component = "openfga"

	ContainerHTTPPort = 8080
	ContainerHTTPName = "http"

	ContainerGRPCPort = 8081
	ContainerGRPCName = "grpc"

	ContainerPlaygroundPort = 3000
	ContainerPlaygroundName = "playground"

	RegistryRepo  = "registry.hub.docker.com"
	RegistryImage = "openfga/openfga"
	ImageTag      = "v0.3.1"

	ContainerName = "openfga"
)
