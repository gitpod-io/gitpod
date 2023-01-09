// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsproxy

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/config"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	header := HostHeader
	blobServeHost := fmt.Sprintf("ide.%s", ctx.Config.Domain)
	gitpodInstallationHostName := ctx.Config.Domain

	installationShortNameSuffix := ""
	if ctx.Config.Metadata.InstallationShortname != "" && ctx.Config.Metadata.InstallationShortname != configv1.InstallationShortNameOldDefault {
		installationShortNameSuffix = "-" + ctx.Config.Metadata.InstallationShortname
	}

	gitpodInstallationWorkspaceHostSuffix := fmt.Sprintf(".ws%s.%s", installationShortNameSuffix, ctx.Config.Domain)
	gitpodInstallationWorkspaceHostSuffixRegex := fmt.Sprintf("\\.ws[^\\.]*\\.%s", ctx.Config.Domain)

	wsManagerConfig := &config.WorkspaceManagerConn{
		Addr: "ws-manager:8080",
		TLS: struct {
			CA   string "json:\"ca\""
			Cert string "json:\"crt\""
			Key  string "json:\"key\""
		}{
			CA:   "/ws-manager-client-tls-certs/ca.crt",
			Cert: "/ws-manager-client-tls-certs/tls.crt",
			Key:  "/ws-manager-client-tls-certs/tls.key",
		},
	}

	ctx.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.WebApp != nil && ucfg.WebApp.WithoutWorkspaceComponents {
			// No ws-manager exists in the application cluster, don't try to connect to it.
			wsManagerConfig = nil
		}
		if ucfg.Workspace == nil {
			return nil
		}
		if ucfg.Workspace.WSProxy.IngressHeader != "" {
			header = ucfg.Workspace.WSProxy.IngressHeader
		}
		if ucfg.Workspace.WSProxy.BlobServeHost != "" {
			blobServeHost = ucfg.Workspace.WSProxy.BlobServeHost
		}
		if ucfg.Workspace.WSProxy.GitpodInstallationHostName != "" {
			gitpodInstallationHostName = ucfg.Workspace.WSProxy.GitpodInstallationHostName
		}
		if ucfg.Workspace.WSProxy.GitpodInstallationWorkspaceHostSuffix != "" {
			gitpodInstallationWorkspaceHostSuffix = ucfg.Workspace.WSProxy.GitpodInstallationWorkspaceHostSuffix
		}
		if ucfg.Workspace.WSProxy.GitpodInstallationWorkspaceHostSuffixRegex != "" {
			gitpodInstallationWorkspaceHostSuffixRegex = ucfg.Workspace.WSProxy.GitpodInstallationWorkspaceHostSuffixRegex
		}
		return nil
	})

	wspcfg := config.Config{
		Namespace: ctx.Namespace,
		Ingress: proxy.HostBasedIngressConfig{
			HTTPAddress:  fmt.Sprintf("0.0.0.0:%d", HTTPProxyPort),
			HTTPSAddress: fmt.Sprintf("0.0.0.0:%d", HTTPSProxyPort),
			Header:       header,
		},
		Proxy: proxy.Config{
			HTTPS: struct {
				Key         string `json:"key"`
				Certificate string `json:"crt"`
			}{
				Key:         "/mnt/certificates/tls.key",
				Certificate: "/mnt/certificates/tls.crt",
			},
			TransportConfig: &proxy.TransportConfig{
				ConnectTimeout:      util.Duration(time.Second * 10),
				IdleConnTimeout:     util.Duration(time.Minute),
				MaxIdleConns:        0,
				MaxIdleConnsPerHost: 100,
			},
			BlobServer: &proxy.BlobServerConfig{
				Scheme:     "https",
				Host:       blobServeHost,
				PathPrefix: "/blobserve",
			},
			GitpodInstallation: &proxy.GitpodInstallation{
				Scheme:                   "https",
				HostName:                 gitpodInstallationHostName,
				WorkspaceHostSuffix:      gitpodInstallationWorkspaceHostSuffix,
				WorkspaceHostSuffixRegex: gitpodInstallationWorkspaceHostSuffixRegex,
			},
			WorkspacePodConfig: &proxy.WorkspacePodConfig{
				TheiaPort:           workspace.ContainerPort,
				IDEDebugPort:        workspace.IDEDebugPort,
				SupervisorPort:      workspace.SupervisorPort,
				SupervisorDebugPort: workspace.SupervisorDebugPort,
				SupervisorImage:     ctx.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
			},
			BuiltinPages: proxy.BuiltinPagesConfig{
				Location: "/app/public",
			},
		},
		PProfAddr:          common.LocalhostAddressFromPort(baseserver.BuiltinDebugPort),
		PrometheusAddr:     common.LocalhostPrometheusAddr(),
		ReadinessProbeAddr: fmt.Sprintf(":%v", ReadinessPort),
		WorkspaceManager:   wsManagerConfig,
	}

	fc, err := common.ToJSONString(wspcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-proxy config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        Component,
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
