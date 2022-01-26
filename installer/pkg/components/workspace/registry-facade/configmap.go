// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/ide"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ws-manager"
	regfac "github.com/gitpod-io/gitpod/registry-facade/api/config"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var tls regfac.TLS
	if ctx.Config.Certificate.Name != "" {
		tls = regfac.TLS{
			Certificate: "/mnt/certificates/tls.crt",
			PrivateKey:  "/mnt/certificates/tls.key",
		}
	}

	rfcfg := regfac.ServiceConfig{
		Registry: regfac.Config{
			Port: ContainerPort,
			RemoteSpecProvider: &regfac.RSProvider{
				Addr: fmt.Sprintf("dns:///ws-manager:%d", wsmanager.RPCPort),
				TLS: &regfac.TLS{
					Authority:   "/ws-manager-client-tls-certs/ca.crt",
					Certificate: "/ws-manager-client-tls-certs/tls.crt",
					PrivateKey:  "/ws-manager-client-tls-certs/tls.key",
				},
			},
			TLS:         &tls,
			Store:       "/mnt/cache/registry",
			RequireAuth: false,
			StaticLayer: []regfac.StaticLayerCfg{
				{
					Ref:  common.ImageName(ctx.Config.Repository, ide.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
					Type: "image",
				},
				{
					Ref:  common.ImageName(ctx.Config.Repository, WorkspacekitImage, ctx.VersionManifest.Components.Workspace.Workspacekit.Version),
					Type: "image",
				},
				{
					Ref:  common.ImageName(ctx.Config.Repository, DockerUpImage, ctx.VersionManifest.Components.Workspace.DockerUp.Version),
					Type: "image",
				},
			},
		},
		AuthCfg:        "/mnt/pull-secret.json",
		PProfAddr:      ":6060",
		PrometheusAddr: "127.0.0.1:9500",
	}

	fc, err := common.ToJSONString(rfcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal registry-facade config: %w", err)
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
