// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	"github.com/gitpod-io/gitpod/registry-facade/api/config"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var tls config.TLS
	if ctx.Config.Certificate.Name != "" {
		tls = config.TLS{
			Certificate: "/mnt/certificates/tls.crt",
			PrivateKey:  "/mnt/certificates/tls.key",
		}
	}

	rfcfg := config.ServiceConfig{
		Registry: config.Config{
			Port: ContainerPort,
			RemoteSpecProvider: &config.RSProvider{
				Addr: fmt.Sprintf("dns:///ws-manager:%d", wsmanager.RPCPort),
				TLS: &config.TLS{
					Authority:   "/ws-manager-client-tls-certs/ca.crt",
					Certificate: "/ws-manager-client-tls-certs/tls.crt",
					PrivateKey:  "/ws-manager-client-tls-certs/tls.key",
				},
			},
			TLS:         &tls,
			Store:       "/mnt/cache/registry",
			RequireAuth: false,
			// todo(sje): figure out these values
			StaticLayer: []config.StaticLayerCfg{{
				Ref:  common.ImageName(ctx.Config.Repository, Component, "todo"),
				Type: "image",
			}, {
				Ref:  common.ImageName(ctx.Config.Repository, Component, "todo"),
				Type: "image",
			}},
		},
		// todo(sje): only enabled if the pullSecret is not nil in daemonset
		AuthCfg:        "/mnt/pull-secret.json",
		PProfAddr:      ":6060",
		PrometheusAddr: "127.0.0.1:9500",
	}

	fc, err := json.MarshalIndent(rfcfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal registry-facade config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaNetworkPolicy,
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
