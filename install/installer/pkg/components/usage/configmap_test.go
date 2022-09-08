// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
)

func TestConfigMap_ContainsSchedule(t *testing.T) {
	ctx := renderContextWithUsageConfig(t, &experimental.UsageConfig{Enabled: true, Schedule: "2m"})

	objs, err := configmap(ctx)
	require.NoError(t, err)

	cfgmap, ok := objs[0].(*corev1.ConfigMap)
	require.True(t, ok)

	require.JSONEq(t,
		`{
       "controllerSchedule": "2m",
       "stripeCredentialsFile": "stripe-secret/apikeys",
       "server": {
         "services": {
           "grpc": {
             "address": ":9001"
           }
         }
       }
     }`,
		cfgmap.Data[configJSONFilename],
	)
}

func TestConfigMap_ContainsBillInstancesAfter(t *testing.T) {
	afterTime := time.Date(2022, 8, 4, 0, 0, 0, 0, time.UTC)
	ctx := renderContextWithUsageConfig(t, &experimental.UsageConfig{Enabled: true, BillInstancesAfter: &afterTime})

	objs, err := configmap(ctx)
	require.NoError(t, err)

	cfgmap, ok := objs[0].(*corev1.ConfigMap)
	require.True(t, ok)

	require.JSONEq(t,
		`{
       "billInstancesAfter": "2022-08-04T00:00:00Z",
       "stripeCredentialsFile": "stripe-secret/apikeys",
       "server": {
         "services": {
           "grpc": {
             "address": ":9001"
           }
         }
       }
     }`,
		cfgmap.Data[configJSONFilename],
	)
}
