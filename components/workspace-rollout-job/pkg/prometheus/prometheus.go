// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package prometheus

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

const (
	// Rate of increase in error count
	errorMetric = "rate(gitpod_ws_manager_workspace_starts_failure_total{cluster=%s})"
)

// TODO: Mock this out so that we can test the logic in rollout
func RetrieveErrorRate(ctx context.Context, startTime time.Time, clusterName string) (int64, error) {
	client, err := api.NewClient(api.Config{
		Address: "http://localhost:9090",
	})
	if err != nil {
		return -1, err
	}

	v1api := v1.NewAPI(client)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	result, warnings, err := v1api.QueryRange(ctx, fmt.Sprintf(errorMetric, clusterName), v1.Range{
		Start: startTime,
		End:   time.Now(),
	})
	if err != nil {
		return -1, err
	}
	if len(warnings) > 0 {
		log.Warnf("Warnings: %v\n", warnings)
	}

	val := float64(result.(*model.Scalar).Value)
	if math.IsNaN(val) {
		return -1, errors.New("query result value is not-a-number")
	}

	return int64(val), nil
}
