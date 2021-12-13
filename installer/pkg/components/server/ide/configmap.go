// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide

import (
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	typeBrowser := "browser"
	typeDesktop := "desktop"
	idecfg := IDEConfig{
		SupervisorImage: common.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
		IDEOptions: IDEOptions{
			Options: map[string]IDEOption{
				"theia": {
					Title:   "Theia (legacy)",
					Tooltip: pointer.String("This entry exists solely for legacy reasons."),
					Type:    typeBrowser,
					Logo:    "invalid",
					Hidden:  pointer.Bool(true),
					Image:   common.ImageName(ctx.Config.Repository, workspace.CodeIDEImage, workspace.CodeIDEImageStableVersion),
				},
				"code": {
					OrderKey: pointer.String("00"),
					Title:    "VS Code",
					Type:     typeBrowser,
					Logo:     "vscode",
					Image:    common.ImageName(ctx.Config.Repository, workspace.CodeIDEImage, workspace.CodeIDEImageStableVersion),
				},
				"code-latest": {
					OrderKey:           pointer.String("01"),
					Title:              "VS Code",
					Type:               typeBrowser,
					Logo:               "vscode-insiders",
					Tooltip:            pointer.String("Early access version, still subject to testing."),
					Label:              pointer.String("Insiders"),
					Image:              common.ImageName(ctx.Config.Repository, workspace.CodeIDEImage, ctx.VersionManifest.Components.Workspace.CodeImage.Version),
					ResolveImageDigest: pointer.Bool(true),
				},
				"code-desktop": {
					OrderKey: pointer.String("02"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     "vscode",
					Image:    common.ImageName(ctx.Config.Repository, workspace.CodeDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImage.Version),
				},
				"code-desktop-insiders": {
					OrderKey: pointer.String("03"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     "vscode-insiders",
					Tooltip:  pointer.String("Visual Studio Code Insiders for early adopters."),
					Label:    pointer.String("Insiders"),
					Image:    common.ImageName(ctx.Config.Repository, workspace.CodeDesktopInsidersIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImageInsiders.Version),
				},
				"intellij": {
					OrderKey: pointer.String("04"),
					Title:    "IntelliJ IDEA",
					Type:     typeDesktop,
					Logo:     "intellij-idea",
					Notes:    []string{"While in beta, when you open a workspace with IntelliJ IDEA you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, workspace.IntelliJDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.IntelliJImage.Version),
				},
				"goland": {
					OrderKey: pointer.String("05"),
					Title:    "GoLand",
					Type:     typeDesktop,
					Logo:     "goland",
					Notes:    []string{"While in beta, when you open a workspace with GoLand you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, workspace.GoLandDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.GoLandImage.Version),
				},
				"pycharm": {
					OrderKey: pointer.String("06"),
					Title:    "PyCharm",
					Type:     typeDesktop,
					Logo:     "https://upload.wikimedia.org/wikipedia/commons/1/1d/PyCharm_Icon.svg", // TODO(clu): Serve logo from our own components instead of using this wikimedia URL.
					Notes:    []string{"While in beta, when you open a workspace with PyCharm you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, workspace.PyCharmDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PyCharmImage.Version),
				},
				"phpstorm": {
					OrderKey: pointer.String("07"),
					Title:    "PhpStorm",
					Type:     typeDesktop,
					Logo:     "https://upload.wikimedia.org/wikipedia/commons/c/c9/PhpStorm_Icon.svg", // TODO(clu): Serve logo from our own components instead of using this wikimedia URL.
					Notes:    []string{"While in beta, when you open a workspace with PhpStorm you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, workspace.PhpStormDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PhpStormImage.Version),
				},
			},
			DefaultIDE:        "code",
			DefaultDesktopIDE: "code-desktop",
		},
	}

	if idecfg.IDEOptions.Options[idecfg.IDEOptions.DefaultIDE].Type != typeBrowser {
		return nil, fmt.Errorf("default IDE '%s' does not point to a browser IDE option", idecfg.IDEOptions.DefaultIDE)
	}

	if idecfg.IDEOptions.Options[idecfg.IDEOptions.DefaultDesktopIDE].Type != typeDesktop {
		return nil, fmt.Errorf("default desktop IDE '%s' does not point to a desktop IDE option", idecfg.IDEOptions.DefaultIDE)
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
