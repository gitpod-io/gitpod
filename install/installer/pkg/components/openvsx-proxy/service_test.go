// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package openvsx_proxy

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

	ctx := renderContextWithVSXProxyConfig(t, &config.OpenVSX{
		Proxy: &config.OpenVSXProxy{
			Proxy: config.Proxy{
				ServiceAnnotations: annotations,
			},
		},
	})

	objects, err := service(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	svc := objects[0].(*corev1.Service)
	for k, v := range annotations {
		require.Equalf(t, annotations[k], svc.Annotations[k],
			"expected to find annotation %q:%q on openvsx-proxy service, but found %q:%q", k, v, k, svc.Annotations[k])
	}
}

func renderContextWithVSXProxyConfig(t *testing.T, openvsxConfig *config.OpenVSX) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		OpenVSX: *openvsxConfig,
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
