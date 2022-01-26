// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const (
	Component             = common.ServerComponent
	ContainerPort         = 3000
	ContainerPortName     = "http"
	authProviderFilePath  = "/gitpod/auth-providers"
	licenseFilePath       = "/gitpod/license"
	PrometheusPort        = 9500
	PrometheusPortName    = "metrics"
	InstallationAdminPort = common.ServerInstallationAdminPort
	InstallationAdminName = "installation-admin"
	ServicePort           = 3000

	DefaultWorkspaceImage        = "gitpod/workspace-full"
	DefaultWorkspaceImageVersion = "latest"
)
