// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const (
	Component = common.PublicApiComponent

	GRPCPortName      = "grpc"
	GRPCContainerPort = 9001
	GRPCServicePort   = 9001
	HTTPContainerPort = 9002
	HTTPServicePort   = 9002
	HTTPPortName      = "http"

	oidcClientJWTSigningKeyMountPath       = "/secrets/oidc-client-jwt-signing-key"
	stripeSecretMountPath                  = "/secrets/stripe-webhook-secret"
	personalAccessTokenSigningKeyMountPath = "/secrets/personal-access-token-signing-key"
)
