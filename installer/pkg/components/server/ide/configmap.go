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

	codeDesktop := "code-desktop"
	codeDesktopInsiders := "code-desktop-insiders"

	intellij := "intellij"
	goland := "goland"
	pycharm := "pycharm"
	phpstorm := "phpstorm"
	idecfg := IDEConfig{
		SupervisorImage: common.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
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
						"If you don't see an open dialog by the browser, make sure you have <a target='_blank' class='gp-link' href='https://www.jetbrains.com/remote-development/gateway'>JetBrains Gateway</a> with <a target='_blank' class='gp-link' href='https://github.com/gitpod-io/gitpod/blob/main/components/ide/jetbrains/gateway-plugin/doc/installing.md'>Gitpod Plugin</a> installed on your machine, and then click <b>${OPEN_LINK_LABEL}</b> below.",
					},
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
				codeDesktop: {
					OrderKey: pointer.String("02"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("vscode"),
					Image:    common.ImageName(ctx.Config.Repository, ide.CodeDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImage.Version),
				},
				codeDesktopInsiders: {
					OrderKey: pointer.String("03"),
					Title:    "VS Code",
					Type:     typeDesktop,
					Logo:     getIdeLogoPath("vscodeInsiders"),
					Tooltip:  pointer.String("Visual Studio Code Insiders for early adopters."),
					Label:    pointer.String("Insiders"),
					Image:    common.ImageName(ctx.Config.Repository, ide.CodeDesktopInsidersIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImageInsiders.Version),
				},
				intellij: {
					OrderKey:    pointer.String("04"),
					Title:       "IntelliJ IDEA",
					Type:        typeDesktop,
					Logo:        getIdeLogoPath("intellijIdeaLogo"),
					Image:       common.ImageName(ctx.Config.Repository, ide.IntelliJDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.IntelliJImage.Version),
					LatestImage: common.ImageName(ctx.Config.Repository, ide.IntelliJDesktopIDEImage, "latest"),
				},
				goland: {
					OrderKey:    pointer.String("05"),
					Title:       "GoLand",
					Type:        typeDesktop,
					Logo:        getIdeLogoPath("golandLogo"),
					Image:       common.ImageName(ctx.Config.Repository, ide.GoLandDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.GoLandImage.Version),
					LatestImage: common.ImageName(ctx.Config.Repository, ide.GoLandDesktopIdeImage, "latest"),
				},
				pycharm: {
					OrderKey:    pointer.String("06"),
					Title:       "PyCharm",
					Type:        typeDesktop,
					Logo:        getIdeLogoPath("pycharmLogo"),
					Image:       common.ImageName(ctx.Config.Repository, ide.PyCharmDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PyCharmImage.Version),
					LatestImage: common.ImageName(ctx.Config.Repository, ide.PyCharmDesktopIdeImage, "latest"),
				},
				phpstorm: {
					OrderKey:    pointer.String("07"),
					Title:       "PhpStorm",
					Type:        typeDesktop,
					Logo:        getIdeLogoPath("phpstormLogo"),
					Image:       common.ImageName(ctx.Config.Repository, ide.PhpStormDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PhpStormImage.Version),
					LatestImage: common.ImageName(ctx.Config.Repository, ide.PhpStormDesktopIdeImage, "latest"),
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
