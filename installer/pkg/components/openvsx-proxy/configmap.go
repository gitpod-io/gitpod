// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package openvsx_proxy

import (
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	openvsx "github.com/gitpod-io/gitpod/openvsx-proxy/pkg"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"time"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	// todo(sje): enable redis config
	imgcfg := openvsx.Config{
		LogDebug:             true,
		CacheDurationRegular: util.Duration(time.Minute),
		CacheDurationBackup:  util.Duration(time.Hour * 72),
		URLUpstream:          "https://open-vsx.org", // todo(sje): make configurable
		URLLocal:             fmt.Sprintf("https://open-vsx.%s", ctx.Config.Domain),
		MaxIdleConns:         1000,
		MaxIdleConnsPerHost:  1000,
		PrometheusAddr:       fmt.Sprintf(":%d", PrometheusPort),
	}

	fc, err := json.MarshalIndent(imgcfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal openvsx config: %w", err)
	}

	data := map[string]string{
		"config.json": string(fc),
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-config", Component),
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: data,
		},
	}, nil
}
