// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package blobserve

import (
	"fmt"
	"time"

	blobserve_config "github.com/gitpod-io/gitpod/blobserve/pkg/config"
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
	bscfg := blobserve_config.Config{
		BlobServe: blobserve_config.BlobServe{
			Port:    ContainerPort,
			Timeout: util.Duration(time.Second * 5),
			Repos: map[string]blobserve_config.Repo{
				ctx.RepoName(ctx.Config.Repository, ide.CodeIDEImage): {
					PrePull: []string{},
					Workdir: "/ide",
					// TODO consider to provide it as a part of image label or rather inline ${ide} and ${supervisor} in index.html
					// to decouple blobserve and code image
					InlineStatic: []blobserve_config.InlineReplacement{{
						Search:      "{{WORKBENCH_WEB_BASE_URL}}",
						Replacement: "${ide}",
					}, {
						Search:      "{{WORKBENCH_NLS_FALLBACK_URL}}",
						Replacement: "${ide}/out/nls.messages.js",
					}, {
						Search:      "{{WORKBENCH_NLS_URL}}",
						Replacement: "${ide}/out/nls.messages.js",
					}, {
						Search:      "/_supervisor/frontend",
						Replacement: "${supervisor}",
					}},
				},
				ctx.RepoName(ctx.Config.Repository, workspace.SupervisorImage): {
					PrePull: []string{},
					Workdir: "/.supervisor/frontend",
				},
				ctx.RepoName(ctx.Config.Repository, ide.XtermIDEImage): {
					PrePull: []string{},
					Workdir: "/ide/xterm",
					InlineStatic: []blobserve_config.InlineReplacement{{
						Search:      "/_supervisor/frontend",
						Replacement: "${supervisor}",
					}},
				},
			},
			BlobSpace: blobserve_config.BlobSpace{
				Location: "/mnt/cache/blobserve",
				MaxSize:  MaxSizeBytes,
			},
		},
		AuthCfg:            "/mnt/pull-secret/pull-secret.json",
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
