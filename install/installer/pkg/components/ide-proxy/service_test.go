// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide_proxy

import (
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestServiceAnnotations(t *testing.T) {
	annotations := map[string]string{"hello": "world"}

	ctx := renderContextWithIDEProxyConfig(t, &config.Proxy{ServiceAnnotations: annotations})

	objects, err := service(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	svc := objects[0].(*corev1.Service)
	for k, v := range annotations {
		require.Equalf(t, annotations[k], svc.Annotations[k],
			"expected to find annotation %q:%q on ide-proxy service, but found %q:%q", k, v, k, svc.Annotations[k])
	}
}

func renderContextWithIDEProxyConfig(t *testing.T, proxyConfig *config.Proxy) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Components: &config.Components{
			IDE: &config.IDEComponents{
				Proxy: proxyConfig,
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
