// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package analysis

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	logrus "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"k8s.io/client-go/rest"
)

const (
	workspace_start_total_metric   = "sum by (cluster) (increase(gitpod_ws_manager_workspace_starts_total{cluster=~\"%s.*\", type=\"REGULAR\"}[%dms]))"
	workspace_start_failure_metric = "sum by (cluster) (increase(gitpod_ws_manager_workspace_starts_failure_total{cluster=~\"%s.*\", type=\"REGULAR\"}[%dms]))"

	workspace_stop_total_metric   = "sum by (cluster) (increase(gitpod_ws_manager_workspace_stops_total{cluster=~\"%s.*\", type=\"REGULAR\"}[%dms]))"
	workspace_stop_failure_metric = "sum by (cluster) (increase(gitpod_ws_manager_workspace_stops_total{reason=\"failed\",cluster=~\"%s.*\", type=\"REGULAR\"}[%dms]))"

	workspace_backup_total_metric   = "sum by (cluster) (increase(gitpod_ws_manager_workspace_backups_total{cluster=~\"%s.*\", type=\"REGULAR\"}[%dms]))"
	workspace_backup_failure_metric = "sum by (cluster) (increase(gitpod_ws_manager_workspace_backups_failure_total{cluster=~\"%s.*\", type=\"REGULAR\"}[%dms]))"
)

type KeyMetricWrapper struct {
	name          string
	failureMetric string
	totalMetric   string
}

type WorkspaceKeyMetricsAnalyzer struct {
	targetSuccessPercentage int
	startTime               time.Time
	keyMetricsWrappers      []KeyMetricWrapper

	api v1.API
}

func NewWorkspaceKeyMetricsAnalyzer(ctx context.Context, kubeConfig *rest.Config, prometheusURL string, targetSuccessPercentage, localPort int) (*WorkspaceKeyMetricsAnalyzer, error) {
	// Create Prometheus API Client
	client, err := api.NewClient(api.Config{
		Address: prometheusURL,
	})
	if err != nil {
		return nil, err
	}

	v1api := v1.NewAPI(client)

	return &WorkspaceKeyMetricsAnalyzer{
		startTime:               time.Now(),
		targetSuccessPercentage: targetSuccessPercentage,
		keyMetricsWrappers: []KeyMetricWrapper{
			{
				name:          "WorkspaceStartSuccessRatio",
				failureMetric: workspace_start_failure_metric,
				totalMetric:   workspace_start_total_metric,
			},
			{
				name:          "WorkspaceStopSuccessRatio",
				failureMetric: workspace_stop_failure_metric,
				totalMetric:   workspace_stop_total_metric,
			},
			{
				name:          "WorkspaceBackupSuccessRatio",
				failureMetric: workspace_backup_failure_metric,
				totalMetric:   workspace_backup_total_metric,
			},
		},
		api: v1api,
	}, nil
}

func (pa *WorkspaceKeyMetricsAnalyzer) MoveForward(ctx context.Context, clusterName string) (int, error) {
	log := logrus.WithField("component", "workspace-key-metrics-analyzer")
	for _, keyMetricWrapper := range pa.keyMetricsWrappers {
		failureResult, err := pa.executeQueryGetResult(ctx, fmt.Sprintf(keyMetricWrapper.failureMetric, clusterName, time.Since(pa.startTime).Milliseconds()))
		if err != nil {
			return -1, err
		}

		totalResult, err := pa.executeQueryGetResult(ctx, fmt.Sprintf(keyMetricWrapper.totalMetric, clusterName, time.Since(pa.startTime).Milliseconds()))
		if err != nil {
			return -1, err
		}

		log.Infof("Total result: %f, Failure Result: %f", totalResult, failureResult)
		successPercentage := (1 - failureResult/totalResult) * 100
		log.Infof("Percentage for %s: %f", keyMetricWrapper.name, successPercentage)

		if math.IsNaN(successPercentage) {
			return 0, nil
		}

		if successPercentage < float64(pa.targetSuccessPercentage) {
			log.Infof("Percentage for %s is below target success percentage %d: %f", keyMetricWrapper.name, pa.targetSuccessPercentage, successPercentage)
			return -1, nil
		}
	}

	return 1, nil
}

func (pa *WorkspaceKeyMetricsAnalyzer) executeQueryGetResult(ctx context.Context, query string) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	result, warnings, err := pa.api.Query(ctx, query, time.Now())
	if err != nil {
		return -1, fmt.Errorf("query %q failed with error: %v", query, err)
	}
	if len(warnings) > 0 {
		log.Warnf("Warnings: %v\n", warnings)
	}

	vec, ok := result.(model.Vector)
	if !ok {
		return -1, fmt.Errorf("unexpected result type: %T", result)
	}

	// Empty Vector means no data present
	if len(vec) == 0 {
		return 0, nil
	}

	if len(vec) != 1 {
		return -1, fmt.Errorf("unexpected result Prometheus result vector length: %d", len(vec))
	}

	val := float64(vec[0].Value)
	if math.IsNaN(val) {
		return -1, fmt.Errorf("unexpected sample value: %v", vec[0].Value)
	}

	return val, nil
}
