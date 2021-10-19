// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

// This file exists to break cyclic-dependency errors

const (
	BlobServeServicePort      = 4000
	CertManagerCAIssuer       = "ca-issuer"
	DockerRegistryName        = "registry"
	InClusterDbSecret         = "mysql"
	InClusterMessageQueueName = "rabbitmq"
	InClusterMessageQueueTLS  = "messagebus-certificates-secret-core"
	MonitoringChart           = "monitoring"
	ProxyComponent            = "proxy"
	ServerComponent           = "server"
	SystemNodeCritical        = "system-node-critical"
)
