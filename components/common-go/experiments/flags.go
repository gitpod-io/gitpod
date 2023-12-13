// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import "context"

const (
	PersonalAccessTokensEnabledFlag                = "personalAccessTokensEnabled"
	OIDCServiceEnabledFlag                         = "oidcServiceEnabled"
	SupervisorPersistServerAPIChannelWhenStartFlag = "supervisor_persist_serverapi_channel_when_start"
	SupervisorUsePublicAPIFlag                     = "supervisor_experimental_publicapi"
	ApiTokenV0Flag                                 = "apitokenv0_oauth"
	ServiceWaiterSkipComponentsFlag                = "service_waiter_skip_components"
)

func IsPersonalAccessTokensEnabled(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, PersonalAccessTokensEnabledFlag, false, attributes)
}

func IsOIDCServiceEnabled(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, OIDCServiceEnabledFlag, false, attributes)
}

func SupervisorPersistServerAPIChannelWhenStart(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, SupervisorPersistServerAPIChannelWhenStartFlag, true, attributes)
}

func SupervisorUsePublicAPI(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, SupervisorUsePublicAPIFlag, false, attributes)
}

func SupervisorUseApiTokenV0(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, ApiTokenV0Flag, false, attributes)
}
