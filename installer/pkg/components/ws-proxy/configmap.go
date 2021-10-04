// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/config"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	// todo(sje): wsManagerProxy seems to be unused
	wspcfg := config.Config{
		Ingress: proxy.HostBasedIngressConfig{
			HttpAddress:  string(rune(HTTPProxyPort)),
			HttpsAddress: string(rune(HTTPSProxyPort)),
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
				// todo(sje): get blob service port from (future) blob service package
				Host: fmt.Sprintf("blobserve.%s.svc.cluster.local:%d", ctx.Namespace, common.BlobServeServicePort),
			},
			// todo(sje): import gitpod values from (future) gitpod package
			GitpodInstallation: &proxy.GitpodInstallation{
				Scheme: "http",
			},
			// todo(sje): import wspod config from (future) workspace package
			WorkspacePodConfig: &proxy.WorkspacePodConfig{},
			BuiltinPages: proxy.BuiltinPagesConfig{
				Location: "/app/public",
			},
		},
		WorkspaceInfoProviderConfig: proxy.WorkspaceInfoProviderConfig{
			WsManagerAddr:     fmt.Sprintf("ws-manager:%d", wsmanager.RPCPort),
			ReconnectInterval: util.Duration(time.Second * 3),
			TLS: struct {
				CA   string `json:"ca"`
				Cert string `json:"crt"`
				Key  string `json:"key"`
			}{
				CA:   "/ws-manager-client-tls-certs/ca.crt",
				Cert: "/ws-manager-client-tls-certs/tls.crt",
				Key:  "/ws-manager-client-tls-certs/tls.key",
			},
		},
		PProfAddr:          ":60060",
		PrometheusAddr:     ":60095",
		ReadinessProbeAddr: ":60088",
	}

	fc, err := json.MarshalIndent(wspcfg, "", " ")
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
