// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package public_api_server

const (
	Component = "public-api-server"

	HTTPPortName      = "http"
	HTTPContainerPort = 9000
	HTTPServicePort   = 9000

	GRPCPortName      = "grpc"
	GRPCContainerPort = 9001
	GRPCServicePort   = 9001
)
