// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/blobserve/pkg/blobserve"
	"github.com/gitpod-io/gitpod/blobserve/pkg/config"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ide"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	// todo(sje): find this value
	hasOpenVSXProxy := true

	// todo(sje): find this value
	//nolint:typecheck
	openVSXProxyUrl := "vsx-proxy-host"
	if hasOpenVSXProxy {
		openVSXProxyUrl = fmt.Sprintf("open-vsx.%s", ctx.Config.Domain)
	}

	// Check also link below before change values
	// https://github.com/gitpod-io/gitpod/blob/2cba7bd1d8a2accd294ab7733f6da4532e48984c/components/ide/code/startup.sh#L37
	extensionsGalleryItemUrl := "https://open-vsx.org/vscode/item"
	trustedDomain := "https://open-vsx.org"

	bscfg := config.Config{
		BlobServe: blobserve.Config{
			Port:    ContainerPort,
			Timeout: util.Duration(time.Second * 5),
			Repos: map[string]blobserve.Repo{
				ctx.RepoName(ctx.Config.Repository, ide.CodeIDEImage): {
					PrePull: []string{},
					Workdir: "/ide",
					Replacements: []blobserve.StringReplacement{{
						Search:      "vscode-cdn.net",
						Replacement: ctx.Config.Domain,
						Path:        "/ide/out/vs/workbench/workbench.web.main.js",
					}, {
						Search:      "open-vsx.org",
						Replacement: openVSXProxyUrl,
						Path:        "/ide/out/vs/workbench/workbench.web.main.js",
					}, {
						Search:      "{{extensionsGalleryItemUrl}}",
						Replacement: extensionsGalleryItemUrl,
						Path:        "/ide/out/vs/workbench/workbench.web.api.js",
					}, {
						Search:      "{{extensionsGalleryItemUrl}}",
						Replacement: extensionsGalleryItemUrl,
						Path:        "/ide/out/vs/workbench/workbench.web.main.js",
					}, {
						Search:      "{{trustedDomain}}",
						Replacement: trustedDomain,
						Path:        "/ide/out/vs/workbench/workbench.web.api.js",
					}, {
						Search:      "{{trustedDomain}}",
						Replacement: trustedDomain,
						Path:        "/ide/out/vs/workbench/workbench.web.main.js",
					}, {
						Search:      "ide.gitpod.io/code/markeplace.json",
						Replacement: fmt.Sprintf("ide.%s/code/marketplace.json", ctx.Config.Domain),
						Path:        "/ide/out/vs/workbench/workbench.web.main.js",
					}},
					InlineStatic: []blobserve.InlineReplacement{{
						Search:      "${window.location.origin}",
						Replacement: ".",
					}, {
						Search:      "value.startsWith(window.location.origin)",
						Replacement: "value.startsWith(window.location.origin) || value.startsWith('${ide}')",
					}, {
						Search:      "./out",
						Replacement: "${ide}/out",
					}, {
						Search:      "./node_modules",
						Replacement: "${ide}/node_modules",
					}, {
						Search:      "/_supervisor/frontend",
						Replacement: "${supervisor}",
					}},
				},
				ctx.RepoName(ctx.Config.Repository, workspace.SupervisorImage): {
					PrePull: []string{},
					Workdir: "/.supervisor/frontend",
				},
			},
			BlobSpace: blobserve.BlobSpace{
				Location: "/mnt/cache/blobserve",
				MaxSize:  MaxSizeBytes,
			},
		},
		AuthCfg:            "/mnt/pull-secret.json",
		PProfAddr:          common.LocalhostAddressFromPort(baseserver.BuiltinDebugPort),
		PrometheusAddr:     common.LocalhostPrometheusAddr(),
		ReadinessProbeAddr: fmt.Sprintf(":%v", ReadinessPort),
	}

	fc, err := common.ToJSONString(bscfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal blobserve config: %w", err)
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
