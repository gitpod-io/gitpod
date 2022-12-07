// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestTeamMembership_WriteRead(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	membership := &db.TeamMembership{
		ID:             uuid.New(),
		TeamID:         uuid.New(),
		UserID:         uuid.New(),
		Role:           db.TeamMembershipRole_Member,
		SubscriptionID: uuid.New(),
	}

	tx := conn.Create(membership)
	require.NoError(t, tx.Error)

	read := &db.TeamMembership{ID: membership.ID}
	tx = conn.First(read)
	require.NoError(t, tx.Error)
	require.Equal(t, membership, read)
}

func TestListTeamMembershipsForUserIDs(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	userWithTwoTeams := uuid.New()
	memberships := []db.TeamMembership{
		{
			ID:     uuid.New(),
			TeamID: uuid.New(),
			UserID: uuid.New(),
			Role:   db.TeamMembershipRole_Member,
		},
		{
			ID:     uuid.New(),
			TeamID: uuid.New(),
			UserID: userWithTwoTeams,
			Role:   db.TeamMembershipRole_Member,
		},
		{
			ID:     uuid.New(),
			TeamID: uuid.New(),
			UserID: userWithTwoTeams,
			Role:   db.TeamMembershipRole_Member,
		},
	}

	tx := conn.Create(&memberships)
	require.NoError(t, tx.Error)

	for _, scenario := range []struct {
		Name     string
		UserIDs  []uuid.UUID
		Expected int
	}{
		{
			Name:     "no user ids return empty",
			UserIDs:  nil,
			Expected: 0,
		},
		{
			Name:     "no matching user IDs returns empty",
			UserIDs:  []uuid.UUID{uuid.New()},
			Expected: 0,
		},
		{
			Name:     "one matching, and one not returns only one record",
			UserIDs:  []uuid.UUID{memberships[0].UserID, uuid.New()},
			Expected: 1,
		},
		{
			Name:     "all matching returns all records (with duplicate userID in query)",
			UserIDs:  []uuid.UUID{memberships[0].UserID, memberships[1].UserID, memberships[2].UserID},
			Expected: 3,
		},
		{
			Name:     "one ID with multiple memberships returns all membership for the ID",
			UserIDs:  []uuid.UUID{userWithTwoTeams},
			Expected: 2,
		},
	} {
		t.Run(scenario.Name, func(t *testing.T) {
			retrieved, err := db.ListTeamMembershipsForUserIDs(context.Background(), conn, scenario.UserIDs)
			require.NoError(t, err)

			require.Len(t, retrieved, scenario.Expected)
		})
	}
}
