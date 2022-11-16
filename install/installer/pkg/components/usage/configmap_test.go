// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
)

func TestConfigMap_ContainsSchedule(t *testing.T) {
	ctx := renderContextWithUsageConfig(t, &experimental.UsageConfig{Enabled: true, Schedule: "2m", ResetUsageSchedule: "5m"})

	objs, err := configmap(ctx)
	require.NoError(t, err)

	cfgmap, ok := objs[0].(*corev1.ConfigMap)
	require.True(t, ok)

	require.JSONEq(t,
		`{
       "controllerSchedule": "2m",
	   "resetUsageSchedule": "5m",
       "stripeCredentialsFile": "stripe-secret/apikeys",
	   "defaultSpendingLimit": {
		"forUsers": 1000000000,
		"forTeams": 1000000000,
		"minForUsersOnStripe": 0
	   },
	   "stripePrices": {
		"individualUsagePriceIds": {
		  "eur": "",
		  "usd": ""
		},
		"teamUsagePriceIds": {
		  "eur": "",
		  "usd": ""
		}
	   },
       "server": {
         "services": {
           "grpc": {
             "address": "0.0.0.0:9001"
           }
         }
       }
     }`,
		cfgmap.Data[configJSONFilename],
	)
}
