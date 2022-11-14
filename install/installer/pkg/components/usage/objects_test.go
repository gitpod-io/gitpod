// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestObjects_RenderedByDefault(t *testing.T) {
	cfg, version := newConfig(t)
	ctx, err := common.NewRenderContext(cfg, version, "test-namespace")
	require.NoError(t, err)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, objects, "objects should be rendered with default config")
}

func TestObjects_RenderedWhenExperimentalConfigSet(t *testing.T) {
	ctx := renderContextWithUsageEnabled(t)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, objects, "must render objects because experimental config is specified")
	require.Len(t, objects, 7, "should render expected k8s objects")
}

func newConfig(t *testing.T) (config.Config, versions.Manifest) {
	return config.Config{
			Domain: "test.domain.everything.awesome.is",
			Database: config.Database{
				CloudSQL: &config.DatabaseCloudSQL{
					ServiceAccount: config.ObjectRef{
						Name: "gcp-db-creds-service-account-name",
					},
				},
			},
		},
		versions.Manifest{
			Components: versions.Components{
				Usage: versions.Versioned{
					Version: "commit-test-latest",
				},
				ServiceWaiter: versions.Versioned{
					Version: "commit-test-latest",
				},
			},
		}
}

func renderContextWithUsageConfig(t *testing.T, usage *experimental.UsageConfig) *common.RenderContext {
	cfg, version := newConfig(t)

	cfg.Experimental = &experimental.Config{
		WebApp: &experimental.WebAppConfig{
			Usage:  usage,
			Server: &experimental.ServerConfig{StripeSecret: "stripe-secret-name"},
		},
	}

	ctx, err := common.NewRenderContext(cfg, version, "test-namespace")
	require.NoError(t, err)

	return ctx
}

func renderContextWithUsageEnabled(t *testing.T) *common.RenderContext {
	return renderContextWithUsageConfig(t, &experimental.UsageConfig{})
}

func renderContextWithStripeSecretSet(t *testing.T) *common.RenderContext {
	ctx := renderContextWithUsageEnabled(t)

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		cfg.WebApp.Server = &experimental.ServerConfig{StripeSecret: "some-stripe-secret"}
		return nil
	})

	return ctx
}
