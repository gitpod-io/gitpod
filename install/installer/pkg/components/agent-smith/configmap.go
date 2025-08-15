// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package agentsmith

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"
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
			WorkspaceManager: config.WorkspaceManagerConfig{
				Address: fmt.Sprintf("%s:%d", common.WSManagerMk2Component, wsmanagermk2.RPCPort),
				TLS: config.TLS{
					Authority:   "/wsman-certs/ca.crt",
					Certificate: "/wsman-certs/tls.crt",
					PrivateKey:  "/wsman-certs/tls.key",
				},
			},
			Kubernetes:          config.Kubernetes{Enabled: true},
			KubernetesNamespace: ctx.Namespace,
			GitpodAPI: config.GitpodAPI{
				HostURL: fmt.Sprintf("https://%s", ctx.Config.Domain),
			},
		},
	}

	if ctx.Config.Components != nil && ctx.Config.Components.AgentSmith != nil {
		ascfg.Config = *ctx.Config.Components.AgentSmith
		ascfg.Config.KubernetesNamespace = ctx.Namespace

		// Set working area path if filesystem scanning is enabled
		if ascfg.Config.FilesystemScanning != nil && ascfg.Config.FilesystemScanning.Enabled {
			ascfg.Config.FilesystemScanning.Enabled = true
			ascfg.Config.FilesystemScanning.WorkingArea = ContainerWorkingAreaMk2
			ascfg.Config.FilesystemScanning.ScanInterval = config.Duration{Duration: 5 * time.Minute}
		}
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
