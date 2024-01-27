// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"

	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestGetTeamMembership(t *testing.T) {

	t.Run("membership does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		_, err := db.GetOrganizationMembership(context.Background(), conn, uuid.New(), uuid.New())
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("ignores deleted records", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		membership := dbtest.CreateTeamMembership(t, conn, db.OrganizationMembership{})[0]

		err := db.DeleteOrganizationMembership(context.Background(), conn, membership.UserID, membership.OrganizationID)
		require.NoError(t, err)

		_, err = db.GetOrganizationMembership(context.Background(), conn, membership.UserID, membership.OrganizationID)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("retrieves membership", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		membership := dbtest.CreateTeamMembership(t, conn, db.OrganizationMembership{})[0]

		retrieved, err := db.GetOrganizationMembership(context.Background(), conn, membership.UserID, membership.OrganizationID)
		require.NoError(t, err)

		require.Equal(t, membership.ID, retrieved.ID)
		require.Equal(t, membership.Role, retrieved.Role)
		require.Equal(t, membership.UserID, retrieved.UserID)
		require.Equal(t, membership.OrganizationID, retrieved.OrganizationID)
	})
}

func TestDeleteTeamMembership(t *testing.T) {

	t.Run("not found when membership does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		err := db.DeleteOrganizationMembership(context.Background(), conn, uuid.New(), uuid.New())
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})
}
