// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import (
	"context"
	"strings"
)

const (
	OIDCServiceEnabledFlag = "oidcServiceEnabled"
	IdPClaimKeysFlag       = "idp_claim_keys"
	SetJavaXmxFlag         = "supervisor_set_java_xmx"
	SetJavaProcessorCount  = "supervisor_set_java_processor_count"
)

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

func IsSetJavaXmx(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, SetJavaXmxFlag, false, attributes)
}

func IsSetJavaProcessorCount(ctx context.Context, client Client, attributes Attributes) bool {
	return client.GetBoolValue(ctx, SetJavaProcessorCount, false, attributes)
}
