// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
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

	var ipfsCache *regfac.IPFSCacheConfig
	var redisCache *regfac.RedisCacheConfig

	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace == nil {
			return nil
		}

		if ucfg.Workspace.RegistryFacade.RedisCache.Enabled {
			cacheCfg := ucfg.Workspace.RegistryFacade.RedisCache
			redisCache = &regfac.RedisCacheConfig{
				Enabled:            true,
				SingleHostAddress:  cacheCfg.SingleHostAddress,
				Username:           cacheCfg.Username,
				UseTLS:             cacheCfg.UseTLS,
				InsecureSkipVerify: cacheCfg.InsecureSkipVerify,
			}
		}

		if ucfg.Workspace.RegistryFacade.IPFSCache.Enabled {
			cacheCfg := ucfg.Workspace.RegistryFacade.IPFSCache
			ipfsCache = &regfac.IPFSCacheConfig{
				Enabled:  true,
				IPFSAddr: cacheCfg.IPFSAddr,
			}
		}

		return nil
	})

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
					Ref:  ctx.ImageName(ctx.Config.Repository, SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
					Type: "image",
				},
				{
					Ref:  ctx.ImageName(ctx.Config.Repository, WorkspacekitImage, ctx.VersionManifest.Components.Workspace.Workspacekit.Version),
					Type: "image",
				},
				{
					Ref:  ctx.ImageName(ctx.Config.Repository, DockerUpImage, ctx.VersionManifest.Components.Workspace.DockerUp.Version),
					Type: "image",
				},
			},
			IPFSCache:  ipfsCache,
			RedisCache: redisCache,
		},
		AuthCfg:            "/mnt/pull-secret.json",
		PProfAddr:          common.LocalhostAddressFromPort(baseserver.BuiltinDebugPort),
		PrometheusAddr:     common.LocalhostPrometheusAddr(),
		ReadinessProbeAddr: fmt.Sprintf(":%v", ReadinessPort),
	}

	fc, err := common.ToJSONString(rfcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal registry-facade config: %w", err)
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
