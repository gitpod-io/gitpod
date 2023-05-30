// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/stretchr/testify/require"
)

func Test_OrganizationsWriteRead(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	org := dbtest.CreateOrganizations(t, conn, db.Organization{})[0]

	candidates := []db.Organization{
		{ID: org.ID},
	}

	for _, read := range candidates {
		tx := conn.First(&read)
		require.NoError(t, tx.Error)
		require.Equal(t, org.Name, read.Name)
		require.Equal(t, org.Slug, read.Slug)
	}
}

func Test_GetOrganizationBySlug(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	org := dbtest.CreateOrganizations(t, conn, db.Organization{})[0]

	read, err := db.GetOrganizationBySlug(context.Background(), conn, org.Slug)
	require.NoError(t, err)
	require.Equal(t, org.Name, read.Name)
	require.Equal(t, org.Slug, read.Slug)
}

func Test_GetSingleOrganizationWithActiveSSO(t *testing.T) {

	t.Run("not found when no org exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		_, err := db.GetSingleOrganizationWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("not found when only orgs without SSO exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		_ = dbtest.CreateOrganizations(t, conn, db.Organization{}, db.Organization{})

		_, err := db.GetSingleOrganizationWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("found single org with active SSO", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		org := dbtest.CreateOrganizations(t, conn, db.Organization{}, db.Organization{})[1]
		_ = dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: org.ID,
			Active:         true,
		})[0]

		found, err := db.GetSingleOrganizationWithActiveSSO(context.Background(), conn)
		require.NoError(t, err)
		require.Equal(t, org.ID, found.ID)
	})

	t.Run("not found single org with inactive SSO", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		org := dbtest.CreateOrganizations(t, conn, db.Organization{}, db.Organization{})[1]
		_ = dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: org.ID,
			Active:         false,
		})[0]

		_, err := db.GetSingleOrganizationWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("not found if two orgs with active SSO exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		orgs := dbtest.CreateOrganizations(t, conn, db.Organization{}, db.Organization{})
		_ = dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: orgs[0].ID,
			Active:         true,
		}, db.OIDCClientConfig{
			OrganizationID: orgs[1].ID,
			Active:         true,
		})

		_, err := db.GetSingleOrganizationWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})
}
