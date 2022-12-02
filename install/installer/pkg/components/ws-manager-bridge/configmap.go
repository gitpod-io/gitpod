// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	wsmbcfg := Configuration{
		Installation:                        ctx.Config.Metadata.InstallationShortname,
		WSClusterDBReconcileIntervalSeconds: 60,
		ControllerIntervalSeconds:           60,
		ControllerMaxDisconnectSeconds:      150,
		ClusterService: ClusterService{
			Port: 8080, // todo(sje) where does this value come from?
			Host: "localhost",
		},
		Timeouts: Timeouts{
			PreparingPhaseSeconds: 3600,
			BuildingPhaseSeconds:  3600,
			UnknownPhaseSeconds:   600,
			PendingPhaseSeconds:   3600,
			StoppingPhaseSeconds:  3600,
		},
		EmulatePreparingIntervalSeconds: 10,
		StaticBridges:                   InClusterWSManagerList(ctx),
		ClusterSyncIntervalSeconds:      60,
	}

	fc, err := common.ToJSONString(wsmbcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-manager-bridge config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        fmt.Sprintf("%s-config", Component),
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: map[string]string{
				"ws-manager-bridge.json": string(fc),
			},
		},
	}, nil
}
