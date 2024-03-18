// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide_service

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ide"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"

	ide_config "github.com/gitpod-io/gitpod/ide-service-api/config"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func ideConfigConfigmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	getIdeLogoPath := func(name string) string {
		return fmt.Sprintf("https://ide.%s/image/ide-logo/%s.svg", ctx.Config.Domain, name)
	}

	codeDesktop := "code-desktop"

	/*
		Upgrading previous JB Version:

		1. Access the previous JB version at: https://github.com/gitpod-io/gitpod/tree/jb/previous
		2. Upgrade Process:
		   - Navigate to the update script:
		     https://github.com/gitpod-io/gitpod/blob/jb/previous/components/ide/jetbrains/image/gha-update-image
		   - Execute the script with the desired version as an argument. For example, to upgrade to versions below 231:
		     node index.js 231
		   - This action will update both the WORKSPACE.yaml and the backend plugin's target platform version.
		3. Transfer the changes to gradle-latest.properties to avoid version incompatibilities with latest.
		4. Resolve any incompatibility issues that arise with the plugin.
		5. Commit and push your changes to GitHub. This will trigger the build job, generating new images.
		6. Test the new images in preview environments with stable versions.
		7. If everything works as expected, update the versions for the plugin and IDEs here where the previous plugin was used.

		TODO: When should it happen? Once a year? Each time when a new major is released, move previous to next, i.e. tracking 1 year behind?
	*/
	intellijPrevious := "intellij-previous"
	jbPluginPrevious := ctx.ImageName(ctx.Config.Repository, ide.JetBrainsBackendPluginImage, "commit-e7eb44545510a8293c5c6aa814a0ad4e81852e5f")

	intellij := "intellij"
	goland := "goland"
	pycharm := "pycharm"
	phpstorm := "phpstorm"
	rubymine := "rubymine"
	webstorm := "webstorm"
	rider := "rider"
	clion := "clion"
	xterm := "xterm"

	resolveLatestImage := func(name string, tag string, bundledLatest versions.Versioned) string {
		resolveLatest := true
		if ctx.Config.Components != nil && ctx.Config.Components.IDE != nil && ctx.Config.Components.IDE.ResolveLatest != nil {
			resolveLatest = *ctx.Config.Components.IDE.ResolveLatest
		}
		if resolveLatest {
			return ctx.ImageName(ctx.Config.Repository, name, tag)
		}
		return ctx.ImageName(ctx.Config.Repository, name, bundledLatest.Version)
	}

	codeHelperImage := ctx.ImageName(ctx.Config.Repository, ide.CodeHelperIDEImage, ctx.VersionManifest.Components.Workspace.CodeHelperImage.Version)
	codeWebExtensionImage := ctx.ImageName(ctx.Config.Repository, ide.CodeWebExtensionImage, ide.CodeWebExtensionVersion)
	jbPluginImage := ctx.ImageName(ctx.Config.Repository, ide.JetBrainsBackendPluginImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.JetBrainsBackendPluginImage.Version)
	jbPluginLatestImage := ctx.ImageName(ctx.Config.Repository, ide.JetBrainsBackendPluginImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.JetBrainsBackendPluginLatestImage.Version)
	jbLauncherImage := ctx.ImageName(ctx.Config.Repository, ide.JetBrainsLauncherImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.JetBrainsLauncherImage.Version)
	idecfg := ide_config.IDEConfig{
		SupervisorImage: ctx.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
		IdeOptions: ide_config.IDEOptions{
			Clients: map[string]ide_config.IDEClient{
				"vscode": {
					DefaultDesktopIDE: codeDesktop,
					DesktopIDEs:       []string{codeDesktop},
					InstallationSteps: []string{
						"If you don't see an open dialog in your browser, make sure you have <a target='_blank' class='gp-link' href='https://code.visualstudio.com/download'>VS Code</a> installed on your machine, and then click <b>${OPEN_LINK_LABEL}</b> below.",
					},
				},
				"vscode-insiders": {
					DefaultDesktopIDE: codeDesktop,
					DesktopIDEs:       []string{codeDesktop},
					InstallationSteps: []string{
						"If you don't see an open dialog in your browser, make sure you have <a target='_blank' class='gp-link' href='https://code.visualstudio.com/insiders'>VS Code Insiders</a> installed on your machine, and then click <b>${OPEN_LINK_LABEL}</b> below.",
					},
				},
				"jetbrains-gateway": {
					DefaultDesktopIDE: intellij,
					DesktopIDEs:       []string{intellij, goland, pycharm, phpstorm, rubymine, webstorm, rider, clion},
					InstallationSteps: []string{
						"If you don't see an open dialog in your browser, make sure you have the <a target='_blank' class='gp-link' href='https://www.gitpod.io/docs/ides-and-editors/jetbrains-gateway#getting-started-jetbrains-gateway'>JetBrains Gateway with Gitpod Plugin</a> installed on your machine, and then click <b>${OPEN_LINK_LABEL}</b> below.",
					},
				},
			},
			Options: map[string]ide_config.IDEOption{
				"code": {
					OrderKey:          "010",
					Title:             "VS Code",
					Type:              ide_config.IDETypeBrowser,
					Label:             "Browser",
					Logo:              getIdeLogoPath("vscode"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.CodeIDEImage, ide.CodeIDEImageStableVersion),
					ImageLayers:       []string{codeWebExtensionImage, codeHelperImage},
					LatestImage:       resolveLatestImage(ide.CodeIDEImage, "nightly", ctx.VersionManifest.Components.Workspace.CodeImage),
					LatestImageLayers: []string{codeWebExtensionImage, codeHelperImage},
					Versions: []ide_config.IDEVersion{
						{
							Version: "1.87.1",
							Image:   ctx.ImageName(ctx.Config.Repository, ide.CodeIDEImage, "commit-aaa9aeb1a12870ab8c19ca8a928d76849bc24c84"),
							ImageLayers: []string{
								ctx.ImageName(ctx.Config.Repository, ide.CodeWebExtensionImage, "commit-4e069a6195f3926ba8b84725bc806228f4cb94ec"),
								ctx.ImageName(ctx.Config.Repository, ide.CodeHelperIDEImage, "commit-4f921cd94dfe046097167e177a6e781f3aa00d70"),
							},
						},
						{
							Version: "1.87.0",
							Image:   ctx.ImageName(ctx.Config.Repository, ide.CodeIDEImage, "commit-82dc424633bdc7266b46302042dd98af201fa8f8"),
							ImageLayers: []string{
								ctx.ImageName(ctx.Config.Repository, ide.CodeWebExtensionImage, "commit-4e069a6195f3926ba8b84725bc806228f4cb94ec"),
								ctx.ImageName(ctx.Config.Repository, ide.CodeHelperIDEImage, "commit-4f921cd94dfe046097167e177a6e781f3aa00d70"),
							},
						},
						{
							Version: "1.86.2",
							Image:   ctx.ImageName(ctx.Config.Repository, ide.CodeIDEImage, "commit-d86f6aa033943c9650d06339915e68063b0cf142"),
							ImageLayers: []string{
								ctx.ImageName(ctx.Config.Repository, ide.CodeWebExtensionImage, "commit-4e069a6195f3926ba8b84725bc806228f4cb94ec"),
								ctx.ImageName(ctx.Config.Repository, ide.CodeHelperIDEImage, "commit-4f921cd94dfe046097167e177a6e781f3aa00d70"),
							},
						},
					},
				},
				"code1_85": {
					OrderKey:    "011",
					Title:       "VS Code",
					Type:        ide_config.IDETypeBrowser,
					Label:       "Browser",
					Logo:        getIdeLogoPath("vscode"),
					Image:       ctx.ImageName(ctx.Config.Repository, ide.CodeIDEImage, ide.Code1_85IDEImageStableVersion),
					ImageLayers: []string{codeWebExtensionImage, codeHelperImage},
				},
				codeDesktop: {
					OrderKey:    "020",
					Title:       "VS Code",
					Type:        ide_config.IDETypeDesktop,
					Logo:        getIdeLogoPath("vscode"),
					Image:       ctx.ImageName(ctx.Config.Repository, ide.CodeDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImage.Version),
					LatestImage: ctx.ImageName(ctx.Config.Repository, ide.CodeDesktopInsidersIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CodeDesktopImageInsiders.Version),
				},
				intellij: {
					OrderKey:          "040",
					Title:             "IntelliJ IDEA",
					Label:             "Ultimate",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("intellijIdeaLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.IntelliJDesktopIDEImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.IntelliJImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.IntelliJDesktopIDEImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				intellijPrevious: {
					OrderKey:    "041",
					Title:       "IntelliJ IDEA",
					Label:       "Ultimate",
					Type:        ide_config.IDETypeDesktop,
					Logo:        getIdeLogoPath("intellijIdeaLogo"),
					Image:       ctx.ImageName(ctx.Config.Repository, ide.IntelliJDesktopIDEImage, "2022.3.3"),
					ImageLayers: []string{jbPluginPrevious, jbLauncherImage},
				},
				goland: {
					OrderKey:          "050",
					Title:             "GoLand",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("golandLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.GoLandDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.GoLandImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.GoLandDesktopIdeImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				pycharm: {
					OrderKey:          "060",
					Title:             "PyCharm",
					Label:             "Professional",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("pycharmLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.PyCharmDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PyCharmImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.PyCharmDesktopIdeImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				phpstorm: {
					OrderKey:          "070",
					Title:             "PhpStorm",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("phpstormLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.PhpStormDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.PhpStormImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.PhpStormDesktopIdeImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				rubymine: {
					OrderKey:          "080",
					Title:             "RubyMine",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("rubymineLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.RubyMineDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.RubyMineImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.RubyMineDesktopIdeImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				webstorm: {
					OrderKey:          "090",
					Title:             "WebStorm",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("webstormLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.WebStormDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.WebStormImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.WebStormDesktopIdeImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				rider: {
					OrderKey:          "100",
					Title:             "Rider",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("riderLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.RiderDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.RiderImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.RiderDesktopIdeImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				clion: {
					OrderKey:          "110",
					Title:             "CLion",
					Type:              ide_config.IDETypeDesktop,
					Logo:              getIdeLogoPath("clionLogo"),
					Image:             ctx.ImageName(ctx.Config.Repository, ide.CLionDesktopIdeImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.CLionImage.Version),
					LatestImage:       ctx.ImageName(ctx.Config.Repository, ide.CLionDesktopIdeImage, "latest"),
					PluginImage:       jbPluginImage,
					PluginLatestImage: jbPluginLatestImage,
					ImageLayers:       []string{jbPluginImage, jbLauncherImage},
					LatestImageLayers: []string{jbPluginLatestImage, jbLauncherImage},
				},
				xterm: {
					OrderKey: "120",
					Title:    "Terminal",
					Type:     ide_config.IDETypeBrowser,
					Logo:     getIdeLogoPath("terminal"),
					Label:    "Insiders",
					// todo(ft): implement proper versioning for xterm
					Image:              ctx.ImageName(ctx.Config.Repository, ide.XtermIDEImage, "latest"),
					LatestImage:        ctx.ImageName(ctx.Config.Repository, ide.XtermIDEImage, "latest"),
					ResolveImageDigest: true,
				},
			},
			DefaultIde:        "code",
			DefaultDesktopIde: codeDesktop,
		},
	}

	if idecfg.IdeOptions.Options[idecfg.IdeOptions.DefaultIde].Type != ide_config.IDETypeBrowser {
		return nil, fmt.Errorf("editor '%s' does not point to a browser IDE option", idecfg.IdeOptions.DefaultIde)
	}

	if idecfg.IdeOptions.Options[idecfg.IdeOptions.DefaultDesktopIde].Type != ide_config.IDETypeDesktop {
		return nil, fmt.Errorf("default desktop IDE '%s' does not point to a desktop IDE option", idecfg.IdeOptions.DefaultIde)
	}

	fc, err := common.ToJSONString(idecfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ide-config config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        "ide-config",
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
