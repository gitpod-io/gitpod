// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestObjects_RenderedByDefault(t *testing.T) {
	ctx := renderContextWithPublicAPI(t)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, objects)
}

func renderContextWithPublicAPI(t *testing.T) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Domain: "test.domain.everything.awesome.is",
		PersonalAccessTokenSigningKey: config.ObjectRef{
			Name: "personal-access-token-signing-key",
		},
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				PublicAPI: &experimental.PublicAPIConfig{
					StripeSecretName: "stripe-webhook-secret",
				},
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
			PublicAPIServer: versions.Versioned{
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
