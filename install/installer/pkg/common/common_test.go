// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common_test

import (
	"fmt"
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
)

func TestKubeRBACProxyContainer_DefaultPorts(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	container := common.KubeRBACProxyContainer(ctx)
	require.Equal(t, []string{
		"--logtostderr",
		"--insecure-listen-address=[$(IP)]:9500",
		"--upstream=http://127.0.0.1:9500/",
	}, container.Args)
	require.Equal(t, []corev1.ContainerPort{
		{Name: "metrics", ContainerPort: 9500},
	}, container.Ports)
}

func TestKubeRBACProxyContainerWithConfig(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	listenPort := int32(9500)
	container := common.KubeRBACProxyContainerWithConfig(ctx)
	require.Equal(t, []string{
		"--logtostderr",
		fmt.Sprintf("--insecure-listen-address=[$(IP)]:%d", listenPort),
		"--upstream=http://127.0.0.1:9500/",
	}, container.Args)
	require.Equal(t, []corev1.ContainerPort{
		{Name: "metrics", ContainerPort: listenPort},
	}, container.Ports)
}
