// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"fmt"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"

	"github.com/stretchr/testify/require"
)

func TestQueriesForCustomersWithAttributionID_Single(t *testing.T) {
	testCases := []struct {
		Name            string
		AttributionIDs  map[db.AttributionID]int64
		ExpectedQueries []string
	}{
		{
			Name: "1 team id",
			AttributionIDs: map[db.AttributionID]int64{
				db.NewTeamAttributionID("abcd-123"): 1,
			},
			ExpectedQueries: []string{"metadata['attributionId']:'team:abcd-123'"},
		},
		{
			Name: "1 team id, 1 user id",
			AttributionIDs: map[db.AttributionID]int64{
				db.NewTeamAttributionID("abcd-123"): 1,
				db.NewUserAttributionID("abcd-456"): 1,
			},
			ExpectedQueries: []string{"metadata['attributionId']:'team:abcd-123' OR metadata['attributionId']:'user:abcd-456'"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			actualQueries := queriesForCustomersWithAttributionIDs(tc.AttributionIDs)

			require.Equal(t, tc.ExpectedQueries, actualQueries)
		})
	}
}

func TestCustomerQueriesForTeamIds_MultipleQueries(t *testing.T) {
	testCases := []struct {
		Name                    string
		NumberOfTeamIds         int
		ExpectedNumberOfQueries int
	}{
		{
			Name:                    "1 team id",
			NumberOfTeamIds:         1,
			ExpectedNumberOfQueries: 1,
		},
		{
			Name:                    "10 team ids",
			NumberOfTeamIds:         10,
			ExpectedNumberOfQueries: 1,
		},
		{
			Name:                    "11 team ids",
			NumberOfTeamIds:         11,
			ExpectedNumberOfQueries: 2,
		},
		{
			Name:                    "1000 team ids",
			NumberOfTeamIds:         1000,
			ExpectedNumberOfQueries: 100,
		},
	}

	buildTeamIds := func(numberOfTeamIds int) map[db.AttributionID]int64 {
		attributionIDs := map[db.AttributionID]int64{}
		for i := 0; i < numberOfTeamIds; i++ {
			attributionIDs[db.NewTeamAttributionID(fmt.Sprintf("abcd-%d", i))] = 1
		}
		return attributionIDs
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			teamIds := buildTeamIds(tc.NumberOfTeamIds)
			actualQueries := queriesForCustomersWithAttributionIDs(teamIds)

			require.Equal(t, tc.ExpectedNumberOfQueries, len(actualQueries))
		})
	}
}

func TestStartOfNextMonth(t *testing.T) {
	ts := time.Date(2022, 10, 1, 0, 0, 0, 0, time.UTC)

	require.Equal(t, time.Date(2022, 11, 1, 0, 0, 0, 0, time.UTC), getStartOfNextMonth(ts))
}
