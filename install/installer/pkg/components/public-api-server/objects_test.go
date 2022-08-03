// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package public_api_server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestObjects_NotRenderedDefault(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test-namespace")
	require.NoError(t, err)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.Empty(t, objects, "no objects should be rendered with default config")
}

func TestObjects_RenderedWhenExperimentalConfigSet(t *testing.T) {
	ctx := renderContextWithPublicAPIEnabled(t)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, objects, "must render objects because experimental config is specified")
}

func renderContextWithPublicAPIEnabled(t *testing.T) *common.RenderContext {
	return renderContextWithPublicAPIConfig(t, &experimental.PublicAPIConfig{Enabled: true})
}

func renderContextWithPublicAPIConfig(t *testing.T, cfg *experimental.PublicAPIConfig) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Domain: "test.domain.everything.awesome.is",
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				PublicAPI: cfg,
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
