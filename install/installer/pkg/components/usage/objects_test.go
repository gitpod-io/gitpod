// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package usage

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestObjects_NotRenderedByDefault(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test-namespace")
	require.NoError(t, err)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.Empty(t, objects, "no objects should be rendered with default config")
}

func TestObjects_RenderedWhenExperimentalConfigSet(t *testing.T) {
	ctx := renderContextWithUsageEnabled(t)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, objects, "must render objects because experimental config is specified")
	require.Len(t, objects, 7, "should render expected k8s objects")
}

func renderContextWithUsageConfig(t *testing.T, usage *experimental.UsageConfig) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Domain: "test.domain.everything.awesome.is",
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				Usage:  usage,
				Server: &experimental.ServerConfig{StripeSecret: "stripe-secret-name"},
			},
		},
		Database: config.Database{
			CloudSQL: &config.DatabaseCloudSQL{
				ServiceAccount: config.ObjectRef{
					Name: "gcp-db-creds-service-account-name",
				},
			},
		},
	}, versions.Manifest{
		Components: versions.Components{
			Usage: versions.Versioned{
				Version: "commit-test-latest",
			},
			ServiceWaiter: versions.Versioned{
				Version: "commit-test-latest",
			},
		},
	}, "test-namespace")
	require.NoError(t, err)

	return ctx
}

func renderContextWithUsageEnabled(t *testing.T) *common.RenderContext {
	return renderContextWithUsageConfig(t, &experimental.UsageConfig{Enabled: true})
}

func renderContextWithStripeSecretSet(t *testing.T) *common.RenderContext {
	ctx := renderContextWithUsageEnabled(t)

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		cfg.WebApp.Server = &experimental.ServerConfig{StripeSecret: "some-stripe-secret"}
		return nil
	})

	return ctx
}
