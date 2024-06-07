// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import (
	"context"
	"strings"
)

const (
	PersonalAccessTokensEnabledFlag                = "personalAccessTokensEnabled"
	OIDCServiceEnabledFlag                         = "oidcServiceEnabled"
	SupervisorPersistServerAPIChannelWhenStartFlag = "supervisor_persist_serverapi_channel_when_start"
	SupervisorUsePublicAPIFlag                     = "supervisor_experimental_publicapi"
	ServiceWaiterSkipComponentsFlag                = "service_waiter_skip_components"
	IdPClaimKeysFlag                               = "idp_claim_keys"
	SetJavaXmxFlag                                 = "supervisor_set_java_xmx"
	SetJavaProcessorCount                          = "supervisor_set_java_processor_count"
)

func IsPersonalAccessTokensEnabled(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, PersonalAccessTokensEnabledFlag, false, attributes)
}

func GetIdPClaimKeys(ctx context.Context, client Client, attributes Attributes) []string {
	value := client.GetStringValue(ctx, IdPClaimKeysFlag, "undefined", attributes)
	if value == "" || value == "undefined" {
		return []string{}
	}
	return strings.Split(value, ",")
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

func IsSetJavaXmx(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, SetJavaXmxFlag, false, attributes)
}

func IsSetJavaProcessorCount(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, SetJavaProcessorCount, false, attributes)
}
