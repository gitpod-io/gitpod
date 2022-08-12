// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package content_service

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"

	csconfig "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestConfigMap_CanConfigureUsageReportBucketName(t *testing.T) {
	ctx := newRenderContext(t)
	objs, err := configmap(ctx)
	require.NoError(t, err)
	require.Len(t, objs, 1, "must only render one configmap")

	expectedUsageReportConfig := csconfig.UsageReportConfig{BucketName: "some-bucket-name"}
	expectedJSON, err := common.ToJSONString(expectedUsageReportConfig)
	require.NoError(t, err)

	cm, ok := objs[0].(*corev1.ConfigMap)
	require.True(t, ok)

	var fullConfig csconfig.ServiceConfig
	err = json.Unmarshal([]byte(cm.Data["config.json"]), &fullConfig)
	require.NoError(t, err)

	actualUsageReportConfig := fullConfig.UsageReports
	actualJSON, err := common.ToJSONString(actualUsageReportConfig)
	require.NoError(t, err)

	require.JSONEq(t, string(expectedJSON), string(actualJSON))
}

func newRenderContext(t *testing.T) *common.RenderContext {
	t.Helper()

	ctx, err := common.NewRenderContext(config.Config{
		Domain:        "test.domain.everything.awesome.is",
		ObjectStorage: config.ObjectStorage{InCluster: pointer.Bool(true)},
		Experimental: &experimental.Config{
			Workspace: &experimental.WorkspaceConfig{
				ContentService: struct {
					UsageReportBucketName string "json:\"usageReportBucketName\""
				}{UsageReportBucketName: "some-bucket-name"},
			},
		},
	}, versions.Manifest{}, "test-namespace")

	require.NoError(t, err)

	return ctx
}
