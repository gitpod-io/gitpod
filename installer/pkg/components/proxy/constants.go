// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import "github.com/gitpod-io/gitpod/installer/pkg/common"

const (
	Component             = common.ProxyComponent
	ContainerHTTPPort     = common.ProxyContainerHTTPPort
	ContainerHTTPName     = common.ProxyContainerHTTPName
	ContainerHTTPSPort    = common.ProxyContainerHTTPSPort
	ContainerHTTPSName    = common.ProxyContainerHTTPSName
	PrometheusPort        = 9500
	InitContainerImage    = "library/alpine"
	InitContainerTag      = "3.15"
	KubeRBACProxyRepo     = common.KubeRBACProxyRepo
	KubeRBACProxyImage    = common.KubeRBACProxyImage
	KubeRBACProxyTag      = common.KubeRBACProxyTag
	MetricsContainerName  = "metrics"
	ReadinessPort         = 8003
	RegistryAuthSecret    = common.RegistryAuthSecret
	RegistryTLSCertSecret = common.RegistryTLSCertSecret
)
