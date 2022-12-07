// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experimentstest

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/stretchr/testify/require"
)

func TestClient(t *testing.T) {
	ctx := context.Background()
	experimentName := "foo_bar"

	client := &Client{
		BoolMatcher: func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool {
			if experiment == experimentName {
				return true
			}
			return defaultValue
		},
		IntMatcher: func(ctx context.Context, experiment string, defaultValue int, attributes experiments.Attributes) int {
			if experiment == experimentName {
				return 7
			}
			return defaultValue
		},
		FloatMatcher: func(ctx context.Context, experiment string, defaultValue float64, attributes experiments.Attributes) float64 {
			if experiment == experimentName {
				return 133.7
			}
			return defaultValue
		},
		StringMatcher: func(ctx context.Context, experiment, defaultValue string, attributes experiments.Attributes) string {
			if experiment == experimentName {
				return "foo"
			}
			return defaultValue
		},
	}

	require.Equal(t, false, client.GetBoolValue(ctx, "random", false, experiments.Attributes{}))
	require.Equal(t, true, client.GetBoolValue(ctx, experimentName, false, experiments.Attributes{}))

	require.Equal(t, 1, client.GetIntValue(ctx, "random", 1, experiments.Attributes{}))
	require.Equal(t, 7, client.GetIntValue(ctx, experimentName, 1, experiments.Attributes{}))

	require.Equal(t, 1.2, client.GetFloatValue(ctx, "random", 1.2, experiments.Attributes{}))
	require.Equal(t, 133.7, client.GetFloatValue(ctx, experimentName, 1, experiments.Attributes{}))

	require.Equal(t, "bar", client.GetStringValue(ctx, "random", "bar", experiments.Attributes{}))
	require.Equal(t, "foo", client.GetStringValue(ctx, experimentName, "bar", experiments.Attributes{}))
}
