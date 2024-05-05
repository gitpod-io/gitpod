// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// This file exists to break cyclic-dependency errors

var (
	GitpodContainerRegistry = config.GitpodContainerRegistry
)

const (
	AppName                     = "gitpod"
	BlobServeServicePort        = 4000
	CertManagerCAIssuer         = "gitpod-ca-issuer"
	DockerRegistryURL           = "docker.io"
	DockerRegistryName          = "registry"
	InClusterDbSecret           = "mysql"
	KubeRBACProxyRepo           = "quay.io"
	KubeRBACProxyImage          = "brancz/kube-rbac-proxy"
	KubeRBACProxyTag            = "v0.15.0"
	MinioServiceAPIPort         = 9000
	MonitoringChart             = "monitoring"
	ProxyComponent              = "proxy"
	ProxyConfigcatPort          = 9547
	ProxyContainerHTTPPort      = 80
	ProxyContainerHTTPName      = "http"
	ProxyContainerHTTPSPort     = 443
	ProxyContainerHTTPSName     = "https"
	RegistryAuthSecret          = "builtin-registry-auth"
	RegistryTLSCertSecret       = "builtin-registry-certs"
	RegistryFacadeComponent     = "registry-facade"
	RegistryFacadeServicePort   = 31750
	RegistryFacadeTLSCertSecret = "builtin-registry-facade-cert"
	ServerComponent             = "server"
	ServerIAMSessionPort        = 9876
	ServerInstallationAdminPort = 9000
	ServerGRPCAPIPort           = 9877
	ServerPublicAPIPort         = 3001
	SystemNodeCritical          = "system-node-critical"
	PublicApiComponent          = "public-api-server"
	UsageComponent              = "usage"
	WSManagerMk2Component       = "ws-manager-mk2"
	WSManagerBridgeComponent    = "ws-manager-bridge"
	WSProxyComponent            = "ws-proxy"
	ImageBuilderComponent       = "image-builder-mk3"
	ImageBuilderRPCPort         = 8080
	ImageBuilderTLSSecret       = "image-builder-mk3-tls"
	ImageBuilderVolumeTLSCerts  = "image-builder-mk3-tls-certs"
	DebugNodePort               = 9229
	DBCaCertEnvVarName          = "DB_CA_CERT"
	DBCaFileName                = "ca.crt"
	DBCaBasePath                = "/db-ssl"
	DBCaPath                    = DBCaBasePath + "/" + DBCaFileName
	WorkspaceSecretsNamespace   = "workspace-secrets"
	AnnotationConfigChecksum    = "gitpod.io/checksum_config"
	DatabaseConfigMountPath     = "/secrets/database-config"
	AuthPKISecretName           = "auth-pki"
	IDEServiceComponent         = "ide-service"
	OpenVSXProxyComponent       = "openvsx-proxy"
	DashboardComponent          = "dashboard"
	IDEMetricsComponent         = "ide-metrics"
	IDEMetricsPort              = 3000
	IDEProxyComponent           = "ide-proxy"
	IDEProxyPort                = 80
)

var (
	InternalCertDuration = &metav1.Duration{Duration: time.Hour * 24 * 90}
)
