// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package toxiproxy

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

const (
	proxyName      = "mysql"
	configFilename = "toxiproxy.json"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var (
		dbHost = "cloudsqlproxy"
		dbPort = 3306
	)

	if pointer.BoolDeref(ctx.Config.Database.InCluster, false) {
		dbHost = "db"
	}

	txcfg := []ToxiproxyConfig{
		{
			Name:     proxyName,
			Listen:   fmt.Sprintf("[::]:%d", dbPort),
			Upstream: fmt.Sprintf("%s:%d", dbHost, dbPort),
			Enabled:  true,
		},
	}

	serialized, err := common.ToJSONString(txcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal toxiproxy config: %w", err)
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
				configFilename: string(serialized),
			},
		},
	}, nil
}
