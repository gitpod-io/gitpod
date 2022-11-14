// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
)

func TestConfigMap_WithExperimentalOptions(t *testing.T) {
	billinstancesAfter := time.Date(2022, 10, 10, 10, 10, 10, 0, time.UTC)
	ctx := renderContextWithUsageConfig(t, &experimental.UsageConfig{
		Schedule:           "2m",
		ResetUsageSchedule: "5m",
		BillInstancesAfter: &billinstancesAfter,
		DefaultSpendingLimit: &db.DefaultSpendingLimit{
			ForTeams:            123,
			ForUsers:            456,
			MinForUsersOnStripe: 7,
		},
	})

	objs, err := configmap(ctx)
	require.NoError(t, err)

	cfgmap, ok := objs[0].(*corev1.ConfigMap)
	require.True(t, ok)

	require.JSONEq(t,
		`{
       "controllerSchedule": "2m",
	   "resetUsageSchedule": "5m",
       "stripeCredentialsFile": "stripe-secret/apikeys",
	   "creditsPerMinuteByWorkspaceClass": {
		"default": 0.1666666667
	   },
	   "defaultSpendingLimit": {
		"forUsers": 456,
		"forTeams": 123,
		"minForUsersOnStripe": 7
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

func TestConfigMap_WithExperimentalOptions_EmptySchedule(t *testing.T) {
	billinstancesAfter := time.Date(2022, 10, 10, 10, 10, 10, 0, time.UTC)
	ctx := renderContextWithUsageConfig(t, &experimental.UsageConfig{
		Schedule:           "", // empty specifies job is disabled
		ResetUsageSchedule: "", // empty specifies job is disabled
		BillInstancesAfter: &billinstancesAfter,
		DefaultSpendingLimit: &db.DefaultSpendingLimit{
			ForTeams:            123,
			ForUsers:            456,
			MinForUsersOnStripe: 7,
		},
	})

	objs, err := configmap(ctx)
	require.NoError(t, err)

	cfgmap, ok := objs[0].(*corev1.ConfigMap)
	require.True(t, ok)

	require.JSONEq(t,
		`{
       "stripeCredentialsFile": "stripe-secret/apikeys",
	   "creditsPerMinuteByWorkspaceClass": {
		"default": 0.1666666667
	   },
	   "defaultSpendingLimit": {
		"forUsers": 456,
		"forTeams": 123,
		"minForUsersOnStripe": 7
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

func TestConfigMap_DefaultOptions(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{
		Domain: "test.domain.everything.awesome.is",
	}, versions.Manifest{
		Components: versions.Components{
			Usage: versions.Versioned{
				Version: "commit-test-latest",
			},
			ServiceWaiter: versions.Versioned{
				Version: "commit-test-latest",
			},
		},
	}, "test-namespace")
	require.NoError(t, err)

	objs, err := configmap(ctx)
	require.NoError(t, err)

	cfgmap, ok := objs[0].(*corev1.ConfigMap)
	require.True(t, ok)

	require.JSONEq(t,
		`{
       "controllerSchedule": "15m0s",
	   "resetUsageSchedule": "15m0s",
	   "creditsPerMinuteByWorkspaceClass": {
		"default": 0.1666666667
	   },
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
