// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import "github.com/gitpod-io/gitpod/installer/pkg/common"

const (
	Component              = common.ProxyComponent
	ContainerHTTPPort      = common.ProxyContainerHTTPPort
	ContainerHTTPName      = common.ProxyContainerHTTPName
	ContainerHTTPSPort     = common.ProxyContainerHTTPSPort
	ContainerHTTPSName     = common.ProxyContainerHTTPSName
	ContainerSSHPort       = 22
	ContainerSSHName       = "ssh"
	InitContainerImage     = "library/alpine"
	InitContainerTag       = "3.16"
	KubeRBACProxyRepo      = common.KubeRBACProxyRepo
	KubeRBACProxyImage     = common.KubeRBACProxyImage
	KubeRBACProxyTag       = common.KubeRBACProxyTag
	ReadinessPort          = 8003
	RegistryAuthSecret     = common.RegistryAuthSecret
	RegistryTLSCertSecret  = common.RegistryTLSCertSecret
	ContainerAnalyticsPort = 9546
	ContainerAnalyticsName = "analytics"
	ContainerConfigcatPort = common.ProxyConfigcatPort
	ContainerConfigcatName = "configcat"
)
