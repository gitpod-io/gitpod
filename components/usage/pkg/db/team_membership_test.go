// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestTeamMembership_WriteRead(t *testing.T) {
	conn := db.ConnectForTests(t)

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
