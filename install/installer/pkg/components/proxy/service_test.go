// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package proxy

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
)

func TestServiceLoadBalancerIP(t *testing.T) {
	const loadBalancerIP = "123.456.789.0"
	ctx := renderContextWithProxyConfig(t, &experimental.ProxyConfig{StaticIP: loadBalancerIP})

	objects, err := service(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	svc := objects[0].(*corev1.Service)
	require.Equal(t, loadBalancerIP, svc.Spec.LoadBalancerIP)
}

func TestServiceAnnotations(t *testing.T) {
	annotations := map[string]string{"hello": "world"}

	ctx := renderContextWithProxyConfig(t, &experimental.ProxyConfig{ServiceAnnotations: annotations})

	objects, err := service(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	svc := objects[0].(*corev1.Service)
	for k, v := range annotations {
		require.Equalf(t, annotations[k], svc.Annotations[k],
			"expected to find annotation %q:%q on proxy service, but found %q:%q", k, v, k, svc.Annotations[k])
	}
}

func renderContextWithProxyConfig(t *testing.T, proxyConfig *experimental.ProxyConfig) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				ProxyConfig: proxyConfig,
			},
		},
	}, versions.Manifest{
		Components: versions.Components{
			PublicAPIServer: versions.Versioned{
				Version: "commit-test-latest",
			},
		},
	}, "test-namespace")
	require.NoError(t, err)

	return ctx
}
