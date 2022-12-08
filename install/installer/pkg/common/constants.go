// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
	KubeRBACProxyTag            = "v0.12.0"
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
	RegistryFacadeServicePort   = 20000
	RegistryFacadeTLSCertSecret = "builtin-registry-facade-cert"
	ServerComponent             = "server"
	SlowServerComponent         = "slow-server"
	ServerInstallationAdminPort = 9000
	SystemNodeCritical          = "system-node-critical"
	PublicApiComponent          = "public-api-server"
	WSManagerComponent          = "ws-manager"
	WSManagerBridgeComponent    = "ws-manager-bridge"
	WSProxyComponent            = "ws-proxy"
	ImageBuilderComponent       = "image-builder-mk3"
	ImageBuilderRPCPort         = 8080
	DebugNodePort               = 9229

	AnnotationConfigChecksum = "gitpod.io/checksum_config"
)

var (
	InternalCertDuration = &metav1.Duration{Duration: time.Hour * 24 * 90}
)
