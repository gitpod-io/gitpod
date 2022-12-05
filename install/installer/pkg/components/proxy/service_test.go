// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestServiceLoadBalancerIP(t *testing.T) {
	const loadBalancerIP = "123.456.789.0"
	ctx := renderContextWithProxyConfig(t, &experimental.ProxyConfig{StaticIP: loadBalancerIP}, nil)

	objects, err := service(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	svc := objects[0].(*corev1.Service)
	require.Equal(t, loadBalancerIP, svc.Spec.LoadBalancerIP)
}

func TestServiceAnnotations(t *testing.T) {
	testCases := []struct {
		Name        string
		Annotations map[string]string
		Components  *config.Components
		Expect      func(ctx *common.RenderContext, svc *corev1.Service, annotations map[string]string)
	}{
		{
			Name:        "Default to LoadBalancer",
			Annotations: map[string]string{"hello": "world"},
			Expect: func(ctx *common.RenderContext, svc *corev1.Service, annotations map[string]string) {
				// Check standard load balancer annotations
				annotations = loadBalancerAnnotations(ctx, annotations)

				for k, v := range annotations {
					require.Equalf(t, annotations[k], svc.Annotations[k],
						"expected to find annotation %q:%q on proxy service, but found %q:%q", k, v, k, svc.Annotations[k])
				}
			},
		},
		{
			Name: "Set to LoadBalancer",
			Components: &config.Components{
				Proxy: &config.ProxyComponent{
					Service: &config.ComponentTypeService{
						ServiceType: (*corev1.ServiceType)(pointer.String(string(corev1.ServiceTypeLoadBalancer))),
					},
				},
			},
			Annotations: map[string]string{"hello": "world", "hello2": "world2"},
			Expect: func(ctx *common.RenderContext, svc *corev1.Service, annotations map[string]string) {
				// Check standard load balancer annotations
				annotations = loadBalancerAnnotations(ctx, annotations)

				for k, v := range annotations {
					require.Equalf(t, annotations[k], svc.Annotations[k],
						"expected to find annotation %q:%q on proxy service, but found %q:%q", k, v, k, svc.Annotations[k])
				}
			},
		},
		{
			Name: "Set to ClusterIP",
			Components: &config.Components{
				Proxy: &config.ProxyComponent{
					Service: &config.ComponentTypeService{
						ServiceType: (*corev1.ServiceType)(pointer.String(string(corev1.ServiceTypeClusterIP))),
					},
				},
			},
			Annotations: map[string]string{"hello": "world"},
			Expect: func(ctx *common.RenderContext, svc *corev1.Service, annotations map[string]string) {
				// Check standard load balancer annotations not present
				lbAnnotations := loadBalancerAnnotations(ctx, make(map[string]string, 0))

				for k := range lbAnnotations {
					require.NotContains(t, annotations, k)
				}

				for k, v := range annotations {
					require.Equalf(t, annotations[k], svc.Annotations[k],
						"expected to find annotation %q:%q on proxy service, but found %q:%q", k, v, k, svc.Annotations[k])
				}
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {
			ctx := renderContextWithProxyConfig(t, &experimental.ProxyConfig{ServiceAnnotations: testCase.Annotations}, testCase.Components)

			objects, err := service(ctx)
			require.NoError(t, err)

			require.Len(t, objects, 1, "must render only one object")

			svc := objects[0].(*corev1.Service)

			testCase.Expect(ctx, svc, testCase.Annotations)
		})
	}
}

func loadBalancerAnnotations(ctx *common.RenderContext, annotations map[string]string) map[string]string {
	annotations["external-dns.alpha.kubernetes.io/hostname"] = fmt.Sprintf("%s,*.%s,*.ws.%s", ctx.Config.Domain, ctx.Config.Domain, ctx.Config.Domain)
	annotations["cloud.google.com/neg"] = `{"exposed_ports": {"80":{},"443": {}}}`

	return annotations
}

func renderContextWithProxyConfig(t *testing.T, proxyConfig *experimental.ProxyConfig, components *config.Components) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Domain:     "some-domain",
		Components: components,
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
