// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package agentsmith

import (
	"fmt"

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
		Namespace:      ctx.Namespace,
		Config: config.Config{
			Kubernetes:          config.Kubernetes{Enabled: true},
			KubernetesNamespace: ctx.Namespace,
			GitpodAPI: config.GitpodAPI{
				HostURL: fmt.Sprintf("https://%s", ctx.Config.Domain),
			},
		},
	}

	if ctx.Config.Experimental.AgentSmith != nil {
		ascfg.Config = *ctx.Config.Experimental.AgentSmith
		ascfg.Config.KubernetesNamespace = ctx.Namespace
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
