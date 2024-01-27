// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package openvsx_proxy

import (
	"fmt"
	"net/url"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	openvsx "github.com/gitpod-io/gitpod/openvsx-proxy/pkg"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	domain, err := url.Parse(ctx.Config.OpenVSX.URL)
	if err != nil {
		return nil, fmt.Errorf("cannot parse openvsx url: %w", err)
	}
	imgcfg := openvsx.Config{
		LogDebug:             false,
		CacheDurationRegular: util.Duration(time.Minute * 5),
		CacheDurationBackup:  util.Duration(time.Hour * 72),
		URLUpstream:          ctx.Config.OpenVSX.URL,
		MaxIdleConns:         1000,
		MaxIdleConnsPerHost:  1000,
		PrometheusAddr:       common.LocalhostPrometheusAddr(),
		RedisAddr:            "localhost:6379",
		AllowCacheDomain:     []string{domain.Host},
	}

	redisCfg := `
maxmemory 100mb
maxmemory-policy allkeys-lfu
	`

	fc, err := common.ToJSONString(imgcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal openvsx config: %w", err)
	}

	data := map[string]string{
		"config.json": string(fc),
		"redis.conf":  redisCfg,
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
			Data: data,
		},
	}, nil
}
