// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestKubeRBACProxyContainer_DefaultPorts(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	container := common.KubeRBACProxyContainer(ctx)
	require.Equal(t, []string{
		"--logtostderr",
		fmt.Sprintf("--insecure-listen-address=[$(IP)]:%v", baseserver.BuiltinMetricsPort),
		fmt.Sprintf("--upstream=http://%v/", common.LocalhostPrometheusAddr()),
		"--http2-disable",
	}, container.Args)
	require.Equal(t, []corev1.ContainerPort{
		{Name: baseserver.BuiltinMetricsPortName, ContainerPort: baseserver.BuiltinMetricsPort},
	}, container.Ports)
}

func TestKubeRBACProxyContainerWithConfig(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	container := common.KubeRBACProxyContainerWithConfig(ctx)
	require.Equal(t, []string{
		"--logtostderr",
		fmt.Sprintf("--insecure-listen-address=[$(IP)]:%d", baseserver.BuiltinMetricsPort),
		fmt.Sprintf("--upstream=http://%v/", common.LocalhostPrometheusAddr()),
		"--http2-disable",
	}, container.Args)
	require.Equal(t, []corev1.ContainerPort{
		{Name: baseserver.BuiltinMetricsPortName, ContainerPort: baseserver.BuiltinMetricsPort},
	}, container.Ports)
}
