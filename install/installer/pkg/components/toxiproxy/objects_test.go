// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package toxiproxy

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
)

func TestObjects_NotRenderedByDefault(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test-namespace")
	require.NoError(t, err)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.Empty(t, objects, "no objects should be rendered with default config")
}

func TestObjects_RenderedWhenExperimentalConfigSet(t *testing.T) {
	ctx := renderContextWithSlowDatabaseEnabled(t)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, objects, "must render objects because experimental config is specified")
	require.Len(t, objects, 4, "should render expected k8s objects")
}

func renderContextWithSlowDatabaseEnabled(t *testing.T) *common.RenderContext {
	t.Helper()

	ctx, err := common.NewRenderContext(config.Config{
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				SlowDatabase: true,
			},
		},
	}, versions.Manifest{}, "test-namespace")
	require.NoError(t, err)

	return ctx
}
