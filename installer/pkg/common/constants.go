// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// This file exists to break cyclic-dependency errors

const (
	AppName                     = "gitpod"
	BlobServeServicePort        = 4000
	CertManagerCAIssuer         = "ca-issuer"
	DockerRegistryURL           = "docker.io"
	DockerRegistryName          = "registry"
	GitpodContainerRegistry     = "eu.gcr.io/gitpod-core-dev/build"
	InClusterDbSecret           = "mysql"
	InClusterMessageQueueName   = "rabbitmq"
	InClusterMessageQueueTLS    = "messagebus-certificates-secret-core"
	KubeRBACProxyRepo           = "quay.io"
	KubeRBACProxyImage          = "brancz/kube-rbac-proxy"
	KubeRBACProxyTag            = "v0.11.0"
	MinioServiceAPIPort         = 9000
	MonitoringChart             = "monitoring"
	ProxyComponent              = "proxy"
	ProxyContainerHTTPPort      = 80
	ProxyContainerHTTPName      = "http"
	ProxyContainerHTTPSPort     = 443
	ProxyContainerHTTPSName     = "https"
	RegistryAuthSecret          = "builtin-registry-auth"
	RegistryTLSCertSecret       = "builtin-registry-certs"
	RegistryFacadeComponent     = "registry-facade"
	RegistryFacadeServicePort   = 30000
	RegistryFacadeTLSCertSecret = "builtin-registry-facade-cert"
	ServerComponent             = "server"
	SystemNodeCritical          = "system-node-critical"
	WSManagerComponent          = "ws-manager"
	WSManagerBridgeComponent    = "ws-manager-bridge"
	WSProxyComponent            = "ws-proxy"
	WSSchedulerComponent        = "ws-scheduler"

	AnnotationConfigChecksum = "gitpod.io/checksum_config"
)

var (
	InternalCertDuration = &metav1.Duration{Duration: time.Hour * 24 * 90}
)
