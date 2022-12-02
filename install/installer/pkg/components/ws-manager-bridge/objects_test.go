// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

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
		SkipSelf                bool
		ExpectWorkspaceClusters bool
	}{
		{SkipSelf: true, ExpectWorkspaceClusters: false},
		{SkipSelf: false, ExpectWorkspaceClusters: true},
	}

	for _, testCase := range testCases {
		ctx := renderContextWithConfig(t, testCase.SkipSelf)

		wsclusters := InClusterWSManagerList(ctx)
		if testCase.ExpectWorkspaceClusters {
			require.NotEmptyf(t, wsclusters, "expected to render workspace clusters when skipSelf=%v", testCase.SkipSelf)
		} else {
			require.Emptyf(t, wsclusters, "expected not to render workspace clusters when skipSelf=%v", testCase.SkipSelf)
		}
	}
}

func renderContextWithConfig(t *testing.T, skipSelf bool) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
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
