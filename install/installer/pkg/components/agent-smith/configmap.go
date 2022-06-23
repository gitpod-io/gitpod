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

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
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
