// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package analysis

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type Decision int

const (
	DecisionRevert      Decision = -1
	DecisionNoData      Decision = 0
	DecisionMoveForward Decision = 1
)

type Analyzer interface {
	// Given a cluster name, MoveForward is called by the rollout routine
	// repeatedly to determine whether to move forward on the rollout or not.
	MoveForward(ctx context.Context, clusterName string) (Decision, error)
}

func CheckPrometheusReachable(ctx context.Context, prometheusURL string) error {
	if prometheusURL == "" {
		return nil
	}

	client, err := api.NewClient(api.Config{
		Address: prometheusURL,
	})
	if err != nil {
		return err
	}

	v1Client := v1.NewAPI(client)
	_, _, err = v1Client.Query(ctx, "up", time.Now())
	if err != nil {
		return err
	}

	return nil
}
