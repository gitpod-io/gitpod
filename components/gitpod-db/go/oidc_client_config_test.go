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

func TestCreateOIDCClientConfig_Create(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{})[0]

	retrieved, err := db.GetOIDCClientConfig(context.Background(), conn, created.ID)
	require.NoError(t, err)
	require.Equal(t, created, retrieved)
}

func TestListOIDCClientConfigsForOrganization(t *testing.T) {
	ctx := context.Background()
	conn := dbtest.ConnectForTests(t)

	orgA, orgB := uuid.New(), uuid.New()

	dbtest.CreateOIDCClientConfigs(t, conn,
		dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
			OrganizationID: orgA,
		}),
		dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
			OrganizationID: orgA,
		}),
		dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
			OrganizationID: orgB,
		}),
	)

	configsForOrgA, err := db.ListOIDCClientConfigsForOrganization(ctx, conn, orgA)
	require.NoError(t, err)
	require.Len(t, configsForOrgA, 2)

	configsForOrgB, err := db.ListOIDCClientConfigsForOrganization(ctx, conn, orgB)
	require.NoError(t, err)
	require.Len(t, configsForOrgB, 1)

	configsForRandomOrg, err := db.ListOIDCClientConfigsForOrganization(ctx, conn, uuid.New())
	require.NoError(t, err)
	require.Len(t, configsForRandomOrg, 0)
}

func TestDeleteOIDCClientConfig(t *testing.T) {

	t.Run("returns not found, when record does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		orgID := uuid.New()

		err := db.DeleteOIDCClientConfig(context.Background(), conn, uuid.New(), orgID)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("marks record deleted", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		orgID := uuid.New()

		created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: orgID,
		})[0]

		err := db.DeleteOIDCClientConfig(context.Background(), conn, created.ID, created.OrganizationID)
		require.NoError(t, err)

		// Delete only sets the `deleted` field, verify that's true
		var retrieved db.OIDCClientConfig
		tx := conn.Where("id = ?", created.ID).Where("deleted = 1").First(&retrieved)
		require.NoError(t, tx.Error)
	})

}

func TestGetOIDCClientConfigForOrganization(t *testing.T) {

	t.Run("not found when config does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		_, err := db.GetOIDCClientConfigForOrganization(context.Background(), conn, uuid.New(), uuid.New())
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("retrieves config which exists", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		orgID := uuid.New()

		created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: orgID,
		})[0]

		retrieved, err := db.GetOIDCClientConfigForOrganization(context.Background(), conn, created.ID, created.OrganizationID)
		require.NoError(t, err)

		require.Equal(t, created, retrieved)
	})

}
