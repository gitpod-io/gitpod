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

func ideconfigmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	idecfg := IDEConfig{
		IDEVersion:   ctx.VersionManifest.Components.Workspace.CodeImageStable.Version,
		IDEImageRepo: workspace.IDEImageRepo,
		IDEImageAliases: map[string]string{
			"code":        fmt.Sprintf("%s%s:%s", ctx.Config.Repository, workspace.IDEImageRepo, ctx.VersionManifest.Components.Workspace.CodeImageStable.Version),
			"code-latest": fmt.Sprintf("%s%s:%s", ctx.Config.Repository, workspace.IDEImageRepo, ctx.VersionManifest.Components.Workspace.CodeImage.Version),
		},
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
