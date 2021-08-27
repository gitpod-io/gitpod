// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content_service

import (
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/content-service/api/config"
	apiconfig "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	cscfg := config.ServiceConfig{
		Service: config.Service{
			Addr: fmt.Sprintf(":%d", RPCPort),
		},
		Prometheus: config.Prometheus{
			Addr: fmt.Sprintf(":%d", PrometheusPort),
		},
		PProf: config.PProf{
			Addr: fmt.Sprintf(":%d", PProfPort),
		},
		// todo(sje): work out how to cater for different storages
		Storage: apiconfig.StorageConfig{},
	}

	fc, err := json.MarshalIndent(cscfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal content-service config: %w", err)
	}

	return []runtime.Object{&corev1.ConfigMap{
		TypeMeta: common.TypeMetaConfigmap,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Data: map[string]string{
			"config.json": string(fc),
		},
	}}, nil
}
