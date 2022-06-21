// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCustomerQueriesForTeamIds_SingleQuery(t *testing.T) {
	testCases := []struct {
		Name            string
		TeamIds         []string
		ExpectedQueries []string
	}{
		{
			Name:            "1 team id",
			TeamIds:         []string{"abcd-123"},
			ExpectedQueries: []string{"metadata['teamId']:'abcd-123'"},
		},
		{
			Name:            "2 team ids",
			TeamIds:         []string{"abcd-123", "abcd-456"},
			ExpectedQueries: []string{"metadata['teamId']:'abcd-123' OR metadata['teamId']:'abcd-456'"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			actualQueries := queriesForCustomersWithTeamIds(tc.TeamIds)

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

	buildTeamIds := func(numberOfTeamIds int) []string {
		var teamIds []string
		for i := 0; i < numberOfTeamIds; i++ {
			teamIds = append(teamIds, fmt.Sprintf("abcd-%d", i))
		}
		return teamIds
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			teamIds := buildTeamIds(tc.NumberOfTeamIds)
			actualQueries := queriesForCustomersWithTeamIds(teamIds)

			require.Equal(t, tc.ExpectedNumberOfQueries, len(actualQueries))
		})
	}
}

func TestWorkspaceSecondsToCreditsCalcuation(t *testing.T) {
	testCases := []struct {
		Name            string
		Seconds         int64
		ExpectedCredits int64
	}{
		{
			Name:            "0 seconds",
			Seconds:         0,
			ExpectedCredits: 0,
		},
		{
			Name:            "1 second",
			Seconds:         1,
			ExpectedCredits: 1,
		},
		{
			Name:            "60 seconds",
			Seconds:         60,
			ExpectedCredits: 1,
		},
		{
			Name:            "90 seconds",
			Seconds:         90,
			ExpectedCredits: 1,
		},
		{
			Name:            "6 minutes",
			Seconds:         360,
			ExpectedCredits: 1,
		},
		{
			Name:            "6 minutes and 1 second",
			Seconds:         361,
			ExpectedCredits: 2,
		},
		{
			Name:            "1 hour",
			Seconds:         3600,
			ExpectedCredits: 10,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			actualCredits := workspaceSecondsToCredits(tc.Seconds)

			require.Equal(t, tc.ExpectedCredits, actualCredits)
		})
	}
}
