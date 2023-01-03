// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package analysis

import (
	"context"
	"fmt"
	"math"
	"time"

	logrus "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

const (
	// Rate of increase in error count
	errorMetric = "sum by (cluster) (rate(gitpod_ws_manager_workspace_starts_failure_total{cluster=~\"%s.*\"}[%dms]))"
)

type PrometheusAnalyzer struct {
	prometheusURL string
	startTime     time.Time
}

func NewPrometheusAnalyzer(promURL string) *PrometheusAnalyzer {
	return &PrometheusAnalyzer{
		prometheusURL: promURL,
		startTime:     time.Now(),
	}
}

func (pa *PrometheusAnalyzer) MoveForward(ctx context.Context, clusterName string) (bool, error) {
	log := logrus.WithField("component", "prometheus-analyzer")
	client, err := api.NewClient(api.Config{
		Address: pa.prometheusURL,
	})
	if err != nil {
		return false, err
	}

	v1api := v1.NewAPI(client)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	queryResult, warnings, err := v1api.Query(ctx, fmt.Sprintf(errorMetric, clusterName, time.Since(pa.startTime).Milliseconds()), time.Now())
	if err != nil {
		return false, err
	}
	if len(warnings) > 0 {
		log.Warnf("Warnings: %v\n", warnings)
	}

	result, ok := queryResult.(model.Vector)
	if !ok {
		return false, fmt.Errorf("unexpected result type: %T", queryResult)
	}

	if len(result) != 1 {
		if len(result) == 0 {
			log.Infof("No error data found for %s. Proceeding", clusterName)
			return true, nil
		}
		return false, fmt.Errorf("unexpected result Prometheus result vector length: %d", len(result))
	}
	val := float64(result[0].Value)
	if math.IsNaN(val) {
		return false, fmt.Errorf("unexpected sample value: %v", result[0].Value)
	}

	// Return true if the error rate is 0
	if val > 0 {
		log.Infof("Found error metric rate as %f ", val)
		return false, nil
	}

	return true, nil
}
