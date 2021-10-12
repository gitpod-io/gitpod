// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

const (
	Component          = "ws-proxy"
	HostHeader         = "x-wsproxy-host"
	HTTPProxyPort      = 8080
	HTTPProxyPortName  = "http-proxy"
	HTTPSProxyPort     = 9090
	HTTPSProxyPortName = "https-proxy"
	MetricsPort        = 9500
	MetricsPortName    = "metrics"
	ProbePort          = 60088
)
