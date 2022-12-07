// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import "context"

const (
	PersonalAccessTokensEnabledFlag = "personalAccessTokensEnabled"
	OIDCServiceEnabledFlag          = "oidcServiceEnabled"
)

func IsPersonalAccessTokensEnabled(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, PersonalAccessTokensEnabledFlag, false, attributes)
}

func IsOIDCServiceEnabled(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, OIDCServiceEnabledFlag, false, attributes)
}
