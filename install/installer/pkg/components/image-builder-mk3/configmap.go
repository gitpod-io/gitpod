// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/baseserver"

	"github.com/gitpod-io/gitpod/image-builder/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"

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

	workspaceManagerAddress := fmt.Sprintf("%s:%d", common.WSManagerMk2Component, wsmanagermk2.RPCPort)
	orchestrator := config.Configuration{
		WorkspaceManager: config.WorkspaceManagerConfig{
			Address: workspaceManagerAddress,
			TLS: config.TLS{
				Authority:   "/wsman-certs/ca.crt",
				Certificate: "/wsman-certs/tls.crt",
				PrivateKey:  "/wsman-certs/tls.key",
			},
		},
		PullSecret:               secretName,
		PullSecretFile:           "/config/pull-secret/pull-secret.json",
		BaseImageRepository:      fmt.Sprintf("%s/base-images", registryName),
		BuilderImage:             ctx.ImageName(ctx.Config.Repository, BuilderImage, ctx.VersionManifest.Components.ImageBuilderMk3.BuilderImage.Version),
		WorkspaceImageRepository: fmt.Sprintf("%s/workspace-images", registryName),
		EnableAdditionalECRAuth:  ctx.Config.ContainerRegistry.EnableAdditionalECRAuth,
		EnableSOCIIndex:          ctx.Config.ContainerRegistry.EnableSOCIIndex,
	}

	workspaceImage := ctx.Config.Workspace.WorkspaceImage
	if workspaceImage == "" {
		workspaceImage = ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, ""), workspace.DefaultWorkspaceImage, workspace.DefaultWorkspaceImageVersion)
	}

	var tls *baseserver.TLSConfiguration
	if ctx.Config.Kind == configv1.InstallationWorkspace {
		// Only enable TLS in workspace clusters. This check can be removed
		// once image-builder-mk3 has been removed from application clusters
		// (https://github.com/gitpod-io/gitpod/issues/7845).
		tls = &baseserver.TLSConfiguration{
			CAPath:   "/certs/ca.crt",
			CertPath: "/certs/tls.crt",
			KeyPath:  "/certs/tls.key",
		}
	}

	imgcfg := config.ServiceConfig{
		Orchestrator: orchestrator,
		Server: &baseserver.Configuration{
			Services: baseserver.ServicesConfiguration{
				GRPC: &baseserver.ServerConfiguration{
					Address: fmt.Sprintf("0.0.0.0:%d", RPCPort),
					TLS:     tls,
				},
			},
		},
	}

	fc, err := common.ToJSONString(imgcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal image-builder-mk3 config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        fmt.Sprintf("%s-config", Component),
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: map[string]string{
				"image-builder.json": string(fc),
			},
		},
	}, nil
}
