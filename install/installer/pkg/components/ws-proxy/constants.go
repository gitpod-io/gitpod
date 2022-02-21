// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const (
	Component          = common.WSProxyComponent
	HostHeader         = "x-wsproxy-host"
	HTTPProxyPort      = 8080
	HTTPProxyPortName  = "http-proxy"
	HTTPSProxyPort     = 9090
	HTTPSProxyPortName = "https-proxy"
	SSHServicePort     = 22
	SSHTargetPort      = 2200
	SSHPortName        = "ssh"
	MetricsPort        = 9500
	MetricsPortName    = "metrics"
	ProbePort          = 60088
)
