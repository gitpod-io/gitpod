// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import "github.com/gitpod-io/gitpod/installer/pkg/common"

const (
	Component             = common.ProxyComponent
	ContainerHTTPPort     = 80
	ContainerHTTPName     = "http"
	ContainerHTTPSPort    = 443
	ContainerHTTPSName    = "https"
	PrometheusPort        = 9500
	InitContainerImage    = "alpine:3.14"
	KubeRBACProxyImage    = "quay.io/brancz/kube-rbac-proxy:v0.11.0"
	MetricsContainerName  = "metrics"
	ReadinessPort         = 8003
	RegistryAuthSecret    = "builtin-registry-auth"
	RegistryTLSCertSecret = "builtin-registry-certs"
)
