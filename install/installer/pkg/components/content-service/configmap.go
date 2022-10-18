// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package content_service

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"

	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	cscfg := config.ServiceConfig{
		Service: baseserver.ServerConfiguration{
			Address: fmt.Sprintf("0.0.0.0:%d", RPCPort),
		},
		Storage: common.StorageConfig(ctx),
	}

	fc, err := common.ToJSONString(cscfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal content-service config: %w", err)
	}

	return []runtime.Object{&corev1.ConfigMap{
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
	}}, nil
}
