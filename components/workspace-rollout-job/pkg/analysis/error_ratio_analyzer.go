// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package analysis

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	logrus "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	total_metric = "sum(increase(gitpod_ws_manager_workspace_starts_total{cluster=~\"%s.*\"}[%dms])) by (cluster)"

	failure_metric = "sum(increase(gitpod_ws_manager_workspace_starts_failure_total{cluster=~\"%s.*\"}[%dms])) by (cluster)"
)

type ErrorRatioAnalyzer struct {
	targetSuccessPercentage int
	startTime               time.Time

	api v1.API
}

func NewErrorRatioAnalyzer(ctx context.Context, kubeConfig *rest.Config, prometheusResource string, targetSuccessPercentage, localPort int) (*ErrorRatioAnalyzer, error) {
	clientSet, err := kubernetes.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}

	ownerSplit := strings.Split(prometheusResource, "/")
	if len(ownerSplit) != 3 {
		return nil, fmt.Errorf("invalid prometheus service name: %s", prometheusResource)
	}
	namespace := ownerSplit[0]
	ownerKind := ownerSplit[1]
	ownerName := ownerSplit[2]

	// 9090 is the port of the prometheus Service
	port := fmt.Sprintf("%d:%d", localPort, 9090)
	podName, err := util.FindAnyPodWithOwnedBy(clientSet, namespace, ownerKind, ownerName)
	if err != nil {
		return nil, err
	}
	readychan, errchan := util.ForwardPort(ctx, kubeConfig, namespace, podName, port)
	select {
	case <-readychan:
	case err := <-errchan:
		return nil, err
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Create Prometheus API Client
	client, err := api.NewClient(api.Config{
		Address: fmt.Sprintf("http://localhost:%d", localPort),
	})
	if err != nil {
		return nil, err
	}

	v1api := v1.NewAPI(client)

	return &ErrorRatioAnalyzer{
		startTime:               time.Now(),
		targetSuccessPercentage: targetSuccessPercentage,
		api:                     v1api,
	}, nil
}

func (pa *ErrorRatioAnalyzer) MoveForward(ctx context.Context, clusterName string) (int, error) {
	log := logrus.WithField("component", "error-ratio-analyzer")

	failureResult, err := pa.executeQueryGetResult(ctx, fmt.Sprintf(failure_metric, clusterName, time.Since(pa.startTime).Milliseconds()))
	if err != nil {
		return -1, err
	}

	totalResult, err := pa.executeQueryGetResult(ctx, fmt.Sprintf(total_metric, clusterName, time.Since(pa.startTime).Milliseconds()))
	if err != nil {
		return -1, err
	}

	log.Infof("Total result: %f, Failure Result: %f", totalResult, failureResult)
	successPercentage := ((totalResult - failureResult) / totalResult) * 100
	log.Infof("Success Percentage: %f", successPercentage)

	if math.IsNaN(successPercentage) {
		return 0, nil
	}

	if successPercentage < float64(pa.targetSuccessPercentage) {
		return -1, nil
	}

	return 1, nil
}

func (pa *ErrorRatioAnalyzer) executeQueryGetResult(ctx context.Context, query string) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	result, warnings, err := pa.api.Query(ctx, query, time.Now())
	if err != nil {
		return -1, err
	}
	if len(warnings) > 0 {
		log.Warnf("Warnings: %v\n", warnings)
	}

	vec, ok := result.(model.Vector)
	if !ok {
		return -1, fmt.Errorf("unexpected result type: %T", result)
	}

	// Empty Vector means no query present
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
