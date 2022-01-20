// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ide"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	getIdeLogoPath := func(name string) string {
		return fmt.Sprintf("https://ide.%s/image/ide-logo/%s.svg", ctx.Config.Domain, name)
	}
	typeBrowser := "browser"
	typeDesktop := "desktop"

	intellij := "intellij"
	goland := "goland"
	pycharm := "pycharm"
	phpstorm := "phpstorm"
	idecfg := IDEConfig{
		SupervisorImage: common.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
		IDEOptions: IDEOptions{
			IDEClients: map[string]IDEClient{
				"jetbrains-gateway": {
					DefaultDesktopIDE: intellij,
					DesktopIDEs:       []string{intellij, goland, pycharm, phpstorm},
				},
			},
			Options: map[string]IDEOption{
				"code": {
					OrderKey: pointer.String("00"),
					Title:    "VS Code",
					Type:     typeBrowser,
					Logo:     getIdeLogoPath("vscode"),
					Image:    common.ImageName(ctx.Config.Repository, ide.CodeIDEImage, ide.CodeIDEImageStableVersion),
				},
				"code-latest": {
					OrderKey:           pointer.String("01"),
					Title:              "VS Code",
					Type:               typeBrowser,
					Logo:               getIdeLogoPath("vscodeInsiders"),
					Tooltip:            pointer.String("Early access version, still subject to testing."),
					Label:              pointer.String("Insiders"),
					Image:              common.ImageName(ctx.Config.Repository, ide.CodeIDEImage, ctx.VersionManifest.Components.Workspace.CodeImage.Version),
					ResolveImageDigest: pointer.Bool(true),
				},
				"code-desktop": {
					OrderKey: pointer.String("02"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("vscode"),
					Image:    common.ImageName(ctx.Config.Repository, ide.CodeDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImage.Version),
				},
				"code-desktop-insiders": {
					OrderKey: pointer.String("03"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("vscodeInsiders"),
					Tooltip:  pointer.String("Visual Studio Code Insiders for early adopters."),
					Label:    pointer.String("Insiders"),
					Image:    common.ImageName(ctx.Config.Repository, ide.CodeDesktopInsidersIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImageInsiders.Version),
				},
				intellij: {
					OrderKey: pointer.String("04"),
					Title:    "IntelliJ IDEA",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("intellijIdeaLogo"),
					Notes:    []string{"While in beta, when you open a workspace with IntelliJ IDEA you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, ide.IntelliJDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.IntelliJImage.Version),
				},
				goland: {
					OrderKey: pointer.String("05"),
					Title:    "GoLand",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("golandLogo"),
					Notes:    []string{"While in beta, when you open a workspace with GoLand you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, ide.GoLandDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.GoLandImage.Version),
				},
				pycharm: {
					OrderKey: pointer.String("06"),
					Title:    "PyCharm",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("pycharmLogo"),
					Notes:    []string{"While in beta, when you open a workspace with PyCharm you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, ide.PyCharmDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PyCharmImage.Version),
				},
				phpstorm: {
					OrderKey: pointer.String("07"),
					Title:    "PhpStorm",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("phpstormLogo"),
					Notes:    []string{"While in beta, when you open a workspace with PhpStorm you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, ide.PhpStormDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PhpStormImage.Version),
				},
			},
			DefaultIDE:        "code",
			DefaultDesktopIDE: "code-desktop",
		},
	}

	if idecfg.IDEOptions.Options[idecfg.IDEOptions.DefaultIDE].Type != typeBrowser {
		return nil, fmt.Errorf("editor '%s' does not point to a browser IDE option", idecfg.IDEOptions.DefaultIDE)
	}

	if idecfg.IDEOptions.Options[idecfg.IDEOptions.DefaultDesktopIDE].Type != typeDesktop {
		return nil, fmt.Errorf("default desktop IDE '%s' does not point to a desktop IDE option", idecfg.IDEOptions.DefaultIDE)
	}

	fc, err := common.ToJSONString(idecfg)
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
