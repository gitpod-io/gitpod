// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const (
	Component                              = common.ServerComponent
	ContainerPort                          = 3000
	ContainerPortName                      = "http"
	authProviderFilePath                   = "/gitpod/auth-providers"
	licenseFilePath                        = "/gitpod/license"
	stripeSecretMountPath                  = "/stripe-secret"
	linkedInSecretMountPath                = "/linkedin-secret"
	githubAppCertSecret                    = "github-app-cert-secret"
	IAMSessionPort                         = common.ServerIAMSessionPort
	IAMSessionPortName                     = "session"
	InstallationAdminPort                  = common.ServerInstallationAdminPort
	InstallationAdminName                  = "install-admin"
	DebugPortName                          = "debug"
	DebugNodePortName                      = "debugnode"
	ServicePort                            = 3000
	personalAccessTokenSigningKeyMountPath = "/secrets/personal-access-token-signing-key"

	AdminCredentialsSecretName      = "admin-credentials"
	AdminCredentialsSecretMountPath = "/credentials/admin"
	AdminCredentialsSecretKey       = "admin.json"

	GRPCAPIName = "grpc"
	GRPCAPIPort = common.ServerGRPCAPIPort

	PublicAPIName = "publicApi"
	PublicAPIPort = common.ServerPublicAPIPort
)
