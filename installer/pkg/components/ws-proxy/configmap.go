// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/config"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	// todo(sje): wsManagerProxy seems to be unused
	wspcfg := config.Config{
		Namespace: ctx.Namespace,
		Ingress: proxy.HostBasedIngressConfig{
			HTTPAddress:  fmt.Sprintf(":%d", HTTPProxyPort),
			HTTPSAddress: fmt.Sprintf(":%d", HTTPSProxyPort),
			Header:       HostHeader,
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
				Scheme: "http",
				Host:   fmt.Sprintf("blobserve.%s.svc.cluster.local:%d", ctx.Namespace, common.BlobServeServicePort),
			},
			GitpodInstallation: &proxy.GitpodInstallation{
				Scheme:                   "https",
				HostName:                 ctx.Config.Domain,
				WorkspaceHostSuffix:      fmt.Sprintf(".ws.%s", ctx.Config.Domain),
				WorkspaceHostSuffixRegex: fmt.Sprintf("\\.ws[^\\.]*\\.%s", ctx.Config.Domain),
			},
			WorkspacePodConfig: &proxy.WorkspacePodConfig{
				TheiaPort:       workspace.ContainerPort,
				SupervisorPort:  workspace.SupervisorPort,
				SupervisorImage: common.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
			},
			BuiltinPages: proxy.BuiltinPagesConfig{
				Location: "/app/public",
			},
		},
		PProfAddr:          ":60060",
		PrometheusAddr:     ":60095",
		ReadinessProbeAddr: ":60088",
	}

	fc, err := common.ToJSONString(wspcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-proxy config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
