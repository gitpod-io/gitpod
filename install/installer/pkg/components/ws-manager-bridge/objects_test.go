// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestWorkspaceManagerList_WhenSkipSelfIsSet(t *testing.T) {
	testCases := []struct {
		Kind                    config.InstallationKind
		SkipSelf                bool
		ExpectWorkspaceClusters bool
	}{
		{Kind: config.InstallationMeta, SkipSelf: true, ExpectWorkspaceClusters: false},
		{Kind: config.InstallationMeta, SkipSelf: false, ExpectWorkspaceClusters: false}, // cannot mount anything it if there is nothing to mount
		{Kind: config.InstallationFull, SkipSelf: true, ExpectWorkspaceClusters: false},
		{Kind: config.InstallationFull, SkipSelf: false, ExpectWorkspaceClusters: true},
	}

	for _, testCase := range testCases {
		ctx := renderContextWithConfig(t, testCase.Kind, testCase.SkipSelf)

		wsclusters := WSManagerList(ctx)
		if testCase.ExpectWorkspaceClusters {
			require.NotEmptyf(t, wsclusters, "expected to render workspace clusters when skipSelf=%v", testCase.SkipSelf)
		} else {
			require.Emptyf(t, wsclusters, "expected not to render workspace clusters when skipSelf=%v", testCase.SkipSelf)
		}
	}
}

func renderContextWithConfig(t *testing.T, kind config.InstallationKind, skipSelf bool) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Kind: kind,
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				WorkspaceManagerBridge: &experimental.WsManagerBridgeConfig{
					SkipSelf: skipSelf,
				},
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
