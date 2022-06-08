// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content_service

import "github.com/gitpod-io/gitpod/common-go/baseserver"

const (
	Component      = "content-service"
	RPCPort        = 8080
	RPCServiceName = "rpc"
	PrometheusPort = baseserver.BuiltinMetricsPort
	PrometheusName = "metrics"
)
