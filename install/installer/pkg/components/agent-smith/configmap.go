// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package agentsmith

import (
	"encoding/base64"
	"fmt"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var tetragonConfig config.Tetragon
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.Workspace == nil {
			return nil
		}

		tetragonConfig.Enabled = cfg.Workspace.Tetragon.Enabled
		tetragonConfig.Addr = cfg.Workspace.Tetragon.Addr

		return nil
	})

	ascfg := config.ServiceConfig{
		PProfAddr:      fmt.Sprintf("localhost:%d", PProfPort),
		PrometheusAddr: fmt.Sprintf("localhost:%d", PrometheusPort),
		Config: config.Config{
			Blocklists: &config.Blocklists{
				Very: &config.PerLevelBlocklist{
					Signatures: []*classifier.Signature{{
						Name:    "testtarget",
						Domain:  classifier.DomainProcess,
						Kind:    classifier.ObjectELFSymbols,
						Pattern: []byte(base64.StdEncoding.EncodeToString([]byte("agentSmithTestTarget"))),
						Regexp:  false,
					}},
				},
			},
			Kubernetes: config.Kubernetes{Enabled: true},
			GitpodAPI: config.GitpodAPI{
				HostURL: fmt.Sprintf("https://%s", ctx.Config.Domain),
			},
			Tetragon: tetragonConfig,
		},
	}

	fc, err := common.ToJSONString(ascfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal agent-smith config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
