// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	getIdeLogoPath := func(name string) string {
		return fmt.Sprintf("https://%s/image/ide-logo/%s.svg", ctx.Config.Domain, name)
	}
	typeBrowser := "browser"
	typeDesktop := "desktop"

	codeDesktop := "code-desktop"
	codeDesktopInsiders := "code-desktop-insiders"

	intellij := "intellij"
	goland := "goland"
	pycharm := "pycharm"
	phpstorm := "phpstorm"
	idecfg := IDEConfig{
		SupervisorImage: common.ImageName(ctx.Config.Repository, SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
		IDEOptions: IDEOptions{
			IDEClients: map[string]IDEClient{
				"vscode": {
					DefaultDesktopIDE: codeDesktop,
					DesktopIDEs:       []string{codeDesktop},
					InstallationSteps: []string{
						"If you don't see an open dialog by the browser, make sure you have <a target='_blank' class='gp-link' href='https://code.visualstudio.com/download'>VS Code</a> installed on your machine, and then click <b>${OPEN_LINK_LABEL}</b> below.",
					},
				},
				"vscode-insiders": {
					DefaultDesktopIDE: codeDesktopInsiders,
					DesktopIDEs:       []string{codeDesktopInsiders},
					InstallationSteps: []string{
						"If you don't see an open dialog by the browser, make sure you have <a target='_blank' class='gp-link' href='https://code.visualstudio.com/insiders'>VS Code Insiders</a> installed on your machine, and then click <b>${OPEN_LINK_LABEL}</b> below.",
					},
				},
				"jetbrains-gateway": {
					DefaultDesktopIDE: intellij,
					DesktopIDEs:       []string{intellij, goland, pycharm, phpstorm},
					InstallationSteps: []string{
						"If you don't see an open dialog by the browser, make sure you have <a target='_blank' class='gp-link' href='https://www.jetbrains.com/remote-development/gateway'>JetBrains Gateway</a> with <a target='_blank' class='gp-link' href='https://plugins.jetbrains.com/plugin/download?rel=true&updateId=154074'>Gitpod Plugin</a> installed on your machine, and then click <b>${OPEN_LINK_LABEL}</b> below.",
					},
				},
			},
			Options: map[string]IDEOption{
				"code": {
					OrderKey: pointer.String("00"),
					Title:    "VS Code",
					Type:     typeBrowser,
					Logo:     getIdeLogoPath("vscode"),
					Image:    common.ImageName(ctx.Config.Repository, CodeIDEImage, CodeIDEImageStableVersion),
				},
				"code-latest": {
					OrderKey:           pointer.String("01"),
					Title:              "VS Code",
					Type:               typeBrowser,
					Logo:               getIdeLogoPath("vscodeInsiders"),
					Tooltip:            pointer.String("Early access version, still subject to testing."),
					Label:              pointer.String("Insiders"),
					Image:              common.ImageName(ctx.Config.Repository, CodeIDEImage, ctx.VersionManifest.Components.Workspace.CodeImage.Version),
					ResolveImageDigest: pointer.Bool(true),
				},
				codeDesktop: {
					OrderKey: pointer.String("02"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("vscode"),
					Image:    common.ImageName(ctx.Config.Repository, CodeDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImage.Version),
				},
				codeDesktopInsiders: {
					OrderKey: pointer.String("03"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("vscodeInsiders"),
					Tooltip:  pointer.String("Visual Studio Code Insiders for early adopters."),
					Label:    pointer.String("Insiders"),
					Image:    common.ImageName(ctx.Config.Repository, CodeDesktopInsidersIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImageInsiders.Version),
				},
				intellij: {
					OrderKey: pointer.String("04"),
					Title:    "IntelliJ IDEA",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("intellijIdeaLogo"),
					Notes:    []string{"While in beta, when you open a workspace with IntelliJ IDEA you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, IntelliJDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.IntelliJImage.Version),
				},
				goland: {
					OrderKey: pointer.String("05"),
					Title:    "GoLand",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("golandLogo"),
					Notes:    []string{"While in beta, when you open a workspace with GoLand you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, GoLandDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.GoLandImage.Version),
				},
				pycharm: {
					OrderKey: pointer.String("06"),
					Title:    "PyCharm",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("pycharmLogo"),
					Notes:    []string{"While in beta, when you open a workspace with PyCharm you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, PyCharmDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PyCharmImage.Version),
				},
				phpstorm: {
					OrderKey: pointer.String("07"),
					Title:    "PhpStorm",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("phpstormLogo"),
					Notes:    []string{"While in beta, when you open a workspace with PhpStorm you will need to use the password “gitpod”."},
					Image:    common.ImageName(ctx.Config.Repository, PhpStormDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PhpStormImage.Version),
				},
			},
			DefaultIDE:        "code",
			DefaultDesktopIDE: codeDesktop,
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
