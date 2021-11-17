// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func CodeImageStableVersion(ctx *common.RenderContext) string {
	stableVersion := ctx.VersionManifest.Components.Workspace.CodeImageStable.Version
	if stableVersion == "" {
		stableVersion = ctx.VersionManifest.Components.Workspace.CodeImage.Version
	}
	return stableVersion
}

func ideconfigmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	stableVersion := CodeImageStableVersion(ctx)
	idecfg := IDEConfig{
		IDEVersion:   stableVersion,
		IDEImageRepo: workspace.CodeIDEImage,
		IDEImageAliases: map[string]string{
			"code":        common.ImageName(ctx.Config.Repository, workspace.CodeIDEImage, stableVersion),
			"code-latest": common.ImageName(ctx.Config.Repository, workspace.CodeIDEImage, ctx.VersionManifest.Components.Workspace.CodeImage.Version),
		},
		DesktopIDEImageAliases: map[string]string{
			"code-desktop":          common.ImageName(ctx.Config.Repository, workspace.CodeDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImage.Version),
			"code-desktop-insiders": common.ImageName(ctx.Config.Repository, workspace.CodeDesktopInsidersIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImageInsiders.Version),
			"intellij:":             common.ImageName(ctx.Config.Repository, workspace.IntelliJDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.IntelliJImage.Version),
			"goland":                common.ImageName(ctx.Config.Repository, workspace.GoLandDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.GoLandImage.Version),
		},
		SupervisorImage: common.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
	}

	fc, err := json.MarshalIndent(idecfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal server-ide-config config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-ide-config", Component),
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
