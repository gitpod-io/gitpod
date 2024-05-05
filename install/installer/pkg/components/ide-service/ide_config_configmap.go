// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide_service

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"html/template"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ide"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"

	ide_config "github.com/gitpod-io/gitpod/ide-service-api/config"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

//go:embed ide-configmap.json
var ideConfigFile string

func ideConfigConfigmap(ctx *common.RenderContext) ([]runtime.Object, error) {
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

	type ConfigTemplate struct {
		Repository  string
		IdeLogoBase string

		CodeBrowserVersionStable       string
		ResolvedCodeBrowserImageLatest string
		CodeHelperImage                string
		CodeWebExtensionImage          string

		JetBrainsPluginImage           string
		JetBrainsPluginLatestImage     string
		JetBrainsLauncherImage         string
		JetBrainsPluginImagePrevious   string
		JetBrainsLauncherImagePrevious string

		WorkspaceVersions versions.Components
	}

	configTmpl := ConfigTemplate{
		Repository:  ctx.Config.Repository,
		IdeLogoBase: fmt.Sprintf("https://ide.%s/image/ide-logo", ctx.Config.Domain),

		CodeBrowserVersionStable:       ide.CodeIDEImageStableVersion,
		ResolvedCodeBrowserImageLatest: resolveLatestImage(ide.CodeIDEImage, "nightly", ctx.VersionManifest.Components.Workspace.CodeImage),
		CodeHelperImage:                ctx.ImageName(ctx.Config.Repository, ide.CodeHelperIDEImage, ctx.VersionManifest.Components.Workspace.CodeHelperImage.Version),
		CodeWebExtensionImage:          ctx.ImageName(ctx.Config.Repository, ide.CodeWebExtensionImage, ctx.VersionManifest.Components.Workspace.CodeWebExtensionImage.Version),

		JetBrainsPluginImage:           ctx.ImageName(ctx.Config.Repository, ide.JetBrainsBackendPluginImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.JetBrainsBackendPluginImage.Version),
		JetBrainsPluginLatestImage:     ctx.ImageName(ctx.Config.Repository, ide.JetBrainsBackendPluginImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.JetBrainsBackendPluginLatestImage.Version),
		JetBrainsLauncherImage:         ctx.ImageName(ctx.Config.Repository, ide.JetBrainsLauncherImage, ctx.VersionManifest.Components.Workspace.DesktopIdeImages.JetBrainsLauncherImage.Version),
		JetBrainsPluginImagePrevious:   ctx.ImageName(ctx.Config.Repository, ide.JetBrainsBackendPluginImage, "commit-e7eb44545510a8293c5c6aa814a0ad4e81852e5f"),
		JetBrainsLauncherImagePrevious: ctx.ImageName(ctx.Config.Repository, ide.JetBrainsLauncherImage, "commit-b6bd8411cbb5682eb18ef60a3b9fa8cdbb2b64d9"),

		WorkspaceVersions: ctx.VersionManifest.Components,
	}

	tmpl, err := template.New("configmap").Parse(ideConfigFile)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ide-config config: %w", err)
	}

	result := &bytes.Buffer{}
	err = tmpl.Execute(result, configTmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to execute ide-config config: %w", err)
	}

	idecfg := ide_config.IDEConfig{}
	err = json.Unmarshal(result.Bytes(), &idecfg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal ide-config config: %w", err)
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
