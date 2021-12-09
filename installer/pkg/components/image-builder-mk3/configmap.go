// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/image-builder/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var registryName string
	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		registryName = fmt.Sprintf("%s.%s", dockerregistry.RegistryName, ctx.Config.Domain)
	} else if ctx.Config.ContainerRegistry.External != nil {
		registryName = strings.TrimSuffix(ctx.Config.ContainerRegistry.External.URL, "/")
	} else {
		return nil, fmt.Errorf("%s: invalid container registry config", Component)
	}

	secretName, err := pullSecretName(ctx)
	if err != nil {
		return nil, err
	}

	orchestrator := config.Configuration{
		WorkspaceManager: config.WorkspaceManagerConfig{
			Address: fmt.Sprintf("%s:%d", wsmanager.Component, wsmanager.RPCPort),
			TLS: config.TLS{
				Authority:   "/wsman-certs/ca.crt",
				Certificate: "/wsman-certs/tls.crt",
				PrivateKey:  "/wsman-certs/tls.key",
			},
		},
		PullSecret:               secretName,
		PullSecretFile:           PullSecretFile,
		BaseImageRepository:      fmt.Sprintf("%s/base-images", registryName),
		BuilderImage:             common.ImageName(ctx.Config.Repository, BuilderImage, ctx.VersionManifest.Components.ImageBuilderMk3.BuilderImage.Version),
		WorkspaceImageRepository: fmt.Sprintf("%s/workspace-images", registryName),
	}

	imgcfg := config.ServiceConfig{
		Orchestrator: orchestrator,
		RefCache: config.RefCacheConfig{
			Interval: util.Duration(time.Hour * 6).String(),
			Refs: []string{
				common.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, ""), workspace.DefaultWorkspaceImage, workspace.DefaultWorkspaceImageVersion),
			},
		},
		Service: config.Service{
			Addr: fmt.Sprintf(":%d", RPCPort),
		},
		Prometheus: config.Service{
			Addr: fmt.Sprintf("127.0.0.1:%d", PrometheusPort),
		},
		PProf: config.PProf{
			Addr: fmt.Sprintf(":%d", PProfPort),
		},
	}

	fc, err := json.MarshalIndent(imgcfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal image-builder-mk3 config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-config", Component),
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"image-builder.json": string(fc),
			},
		},
	}, nil
}
