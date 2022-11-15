// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package experiments

import "context"

// IsMyFirstFeatureFlagEnabled example usage of a flag
func IsMyFirstFeatureFlagEnabled(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, "isMyFirstFeatureEnabled", false, attributes)
}

func IsPersonalAccessTokensEnabled(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, "personalAccessTokensEnabled", false, attributes)
}
