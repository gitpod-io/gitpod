// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package agentsmith

import (
	"fmt"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	ascfg := config.ServiceConfig{
		PProfAddr:      common.LocalhostAddressFromPort(baseserver.BuiltinDebugPort),
		PrometheusAddr: common.LocalhostPrometheusAddr(),
		Namespace:      ctx.Namespace,
		Config: config.Config{
			Kubernetes:          config.Kubernetes{Enabled: true},
			KubernetesNamespace: ctx.Namespace,
			GitpodAPI: config.GitpodAPI{
				HostURL: fmt.Sprintf("https://%s", ctx.Config.Domain),
			},
		},
	}

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.AgentSmith != nil {
			ascfg.Config = *cfg.AgentSmith
			ascfg.Config.KubernetesNamespace = ctx.Namespace
		}
		return nil
	})

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
