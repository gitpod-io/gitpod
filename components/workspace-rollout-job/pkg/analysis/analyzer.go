// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package analysis

import (
	"context"
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
	// DecisionRevert means to revert
	// DecisionNoData means that there is no data to make an informed decision
	// DecisionMoveForward means to move forward based on data
	MoveForward(ctx context.Context, clusterName string) (Decision, error)
}
