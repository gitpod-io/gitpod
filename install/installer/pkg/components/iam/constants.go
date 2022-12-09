// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package iam

const (
	Component = "iam"

	GRPCPortName               = "grpc"
	GRPCContainerPort          = 9001
	GRPCServicePort            = 9001
	HTTPContainerPort          = 9002
	HTTPServicePort            = 9002
	HTTPPortName               = "http"
	oidcClientsSecretMountPath = "oidc-clients-secret"
	oidcClientsSecretFilename  = "config.json"
)
