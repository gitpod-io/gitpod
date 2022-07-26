// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestCreditSummaryForTeams(t *testing.T) {
	teamID_A, teamID_B := uuid.New().String(), uuid.New().String()
	teamAttributionID_A, teamAttributionID_B := db.NewTeamAttributionID(teamID_A), db.NewTeamAttributionID(teamID_B)

	scenarios := []struct {
		Name     string
		Sessions []*v1.BilledSession
		Expected map[string]int64
	}{
		{
			Name:     "no instances in report, no summary",
			Sessions: []*v1.BilledSession{},
			Expected: map[string]int64{},
		},
		{
			Name: "skips user attributions",
			Sessions: []*v1.BilledSession{
				{
					AttributionId: string(db.NewUserAttributionID(uuid.New().String())),
				},
			},
			Expected: map[string]int64{},
		},
		{
			Name: "two workspace instances",
			Sessions: []*v1.BilledSession{
				{
					// has 1 day and 23 hours of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       (24 + 23) * 10,
				},
				{
					// has 1 hour of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       10,
				},
			},
			Expected: map[string]int64{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: 480,
			},
		},
		{
			Name: "multiple teams",
			Sessions: []*v1.BilledSession{
				{
					// has 12 hours of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       (12) * 10,
				},
				{
					// has 1 day of usage
					AttributionId: string(teamAttributionID_B),
					Credits:       (24) * 10,
				},
			},
			Expected: map[string]int64{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: 120,
				teamID_B: 240,
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			actual, err := creditSummaryForTeams(s.Sessions)
			require.NoError(t, err)
			require.Equal(t, s.Expected, actual)
		})
	}
}
