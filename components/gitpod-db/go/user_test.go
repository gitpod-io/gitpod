// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
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

func TestGetUser(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	user := dbtest.CreatUsers(t, conn, db.User{})[0]

	retrived, err := db.GetUser(context.Background(), conn, user.ID)
	require.NoError(t, err)
	require.Equal(t, user, retrived)
}

func TestGetUserByIdentity(t *testing.T) {

	t.Run("retrieves all identities for a user", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		// Create additional identities not related to our user, to ensure we're selecting correctly
		dbtest.CreateIdentities(t, conn, db.Identity{}, db.Identity{})

		userID := uuid.New()
		identities := []db.Identity{
			dbtest.NewIdentity(t, db.Identity{UserID: userID}),
			dbtest.NewIdentity(t, db.Identity{UserID: userID}),
		}

		user := dbtest.CreatUsers(t, conn, db.User{
			ID:         userID,
			Identities: identities,
		})[0]

		// Test that given any of the identities, we can find the user
		for _, identity := range user.Identities {
			retrived, err := db.GetUserByIdentity(context.Background(), conn, identity.AuthProviderID, identity.AuthID)
			require.NoError(t, err)
			require.Len(t, user.Identities, len(user.Identities), "must return all identities for the user")
			require.Equal(t, user, retrived)
		}
	})

	t.Run("not found when identity does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t).Debug()
		_, err := db.GetUserByIdentity(context.Background(), conn, uuid.NewString(), uuid.NewString())
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

}
