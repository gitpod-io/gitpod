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

func TestGetActiveOIDCClientConfigByOrgSlug(t *testing.T) {

	t.Run("not found when config does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		_, err := db.GetActiveOIDCClientConfigByOrgSlug(context.Background(), conn, "non-existing-org")
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("retrieves config which exists", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		// create a single team
		team := db.Team{
			ID:   uuid.New(),
			Name: "Team1",
			Slug: "team-" + uuid.New().String(),
		}

		_, err := db.CreateTeam(context.Background(), conn, team)
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, conn.Where("slug = ?", team.Slug).Delete(&db.Team{}).Error)
		})

		created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: team.ID,
			Active:         true,
		})[0]

		retrieved, err := db.GetActiveOIDCClientConfigByOrgSlug(context.Background(), conn, team.Slug)
		require.NoError(t, err)

		require.Equal(t, created, retrieved)
	})

	t.Run("retrieves single active config", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		// create a single team
		team := db.Team{
			ID:   uuid.New(),
			Name: "Team1",
			Slug: "team-" + uuid.New().String(),
		}
		_, err := db.CreateTeam(context.Background(), conn, team)
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, conn.Where("slug = ?", team.Slug).Delete(&db.Team{}).Error)
		})

		// create multiple
		activeConfigID := uuid.New()
		configs := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			ID:             uuid.New(),
			OrganizationID: team.ID,
			Active:         false,
		}, db.OIDCClientConfig{
			ID:             activeConfigID,
			OrganizationID: team.ID,
			Active:         true,
		}, db.OIDCClientConfig{
			ID:             uuid.New(),
			OrganizationID: team.ID,
			Active:         false,
		})
		require.Equal(t, 3, len(configs))

		retrieved, err := db.GetActiveOIDCClientConfigByOrgSlug(context.Background(), conn, team.Slug)
		require.NoError(t, err)

		require.Equal(t, activeConfigID, retrieved.ID)

	})

}

func TestActivateClientConfig(t *testing.T) {

	t.Run("not found when config does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		err := db.ActivateClientConfig(context.Background(), conn, uuid.New())
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("config which exists is marked as active", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		config := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: uuid.New(),
			Active:         false,
		})[0]
		configID := config.ID

		config, err := db.GetOIDCClientConfig(context.Background(), conn, configID)
		require.NoError(t, err)
		require.Equal(t, false, config.Active)

		err = db.ActivateClientConfig(context.Background(), conn, configID)
		require.NoError(t, err)

		config2, err := db.GetOIDCClientConfig(context.Background(), conn, configID)
		require.NoError(t, err)
		require.Equal(t, true, config2.Active)

		err = db.ActivateClientConfig(context.Background(), conn, configID)
		require.NoError(t, err)
	})

}

func TestUpdateOIDCSpec(t *testing.T) {

	t.Run("no existing client config exists", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		cipher, _ := dbtest.GetTestCipher(t)

		err := db.UpdateOIDCClientConfig(context.Background(), conn, cipher, db.OIDCClientConfig{
			ID: uuid.New(),
		}, nil)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("no existing client config exists with spec update", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		cipher, _ := dbtest.GetTestCipher(t)

		err := db.UpdateOIDCClientConfig(context.Background(), conn, cipher, db.OIDCClientConfig{
			ID: uuid.New(),
		}, &db.OIDCSpec{})
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("partially updates issuer, active, client id and client secret", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		cipher, _ := dbtest.GetTestCipher(t)

		created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{})[0]

		err := db.UpdateOIDCClientConfig(context.Background(), conn, cipher, db.OIDCClientConfig{
			ID:     created.ID,
			Active: true,
			Issuer: "some-new-issuer",
		}, &db.OIDCSpec{
			ClientID:     "my-new-client-id",
			ClientSecret: "new-client-secret",
		})
		require.NoError(t, err)

		retrieved, err := db.GetOIDCClientConfig(context.Background(), conn, created.ID)
		require.NoError(t, err)

		decrypted, err := retrieved.Data.Decrypt(cipher)
		require.NoError(t, err)
		require.Equal(t, "my-new-client-id", decrypted.ClientID)
		require.Equal(t, "new-client-secret", decrypted.ClientSecret)
		require.True(t, retrieved.Active)
		require.Equal(t, "some-new-issuer", retrieved.Issuer)
	})

	t.Run("partially updates redirect url and scopes", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		cipher, _ := dbtest.GetTestCipher(t)

		created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{})[0]

		err := db.UpdateOIDCClientConfig(context.Background(), conn, cipher, db.OIDCClientConfig{
			ID: created.ID,
		}, &db.OIDCSpec{
			RedirectURL: "new-url",
			Scopes:      []string{"hello"},
		})
		require.NoError(t, err)

		retrieved, err := db.GetOIDCClientConfig(context.Background(), conn, created.ID)
		require.NoError(t, err)

		decrypted, err := retrieved.Data.Decrypt(cipher)
		require.NoError(t, err)
		require.Equal(t, "new-url", decrypted.RedirectURL)
		require.Equal(t, []string{"hello"}, decrypted.Scopes)
	})

	t.Run("partially updates all spec fields", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		cipher, _ := dbtest.GetTestCipher(t)

		created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{})[0]

		updateSpec := db.OIDCSpec{
			RedirectURL:  "new-url",
			ClientID:     "my-new-client-id",
			ClientSecret: "new-client-secret",
			Scopes:       []string{"hello"},
		}

		err := db.UpdateOIDCClientConfig(context.Background(), conn, cipher, db.OIDCClientConfig{
			ID: created.ID,
		}, &updateSpec)
		require.NoError(t, err)

		retrieved, err := db.GetOIDCClientConfig(context.Background(), conn, created.ID)
		require.NoError(t, err)

		decrypted, err := retrieved.Data.Decrypt(cipher)
		require.NoError(t, err)
		require.Equal(t, updateSpec, decrypted)
	})

}
