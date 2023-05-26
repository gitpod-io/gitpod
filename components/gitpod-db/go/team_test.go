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

func Test_WriteRead(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	team := dbtest.CreateTeams(t, conn, db.Team{})[0]

	candidates := []db.Team{
		{ID: team.ID},
	}

	for _, read := range candidates {
		tx := conn.First(&read)
		require.NoError(t, tx.Error)
		require.Equal(t, team.Name, read.Name)
		require.Equal(t, team.Slug, read.Slug)
	}
}

func Test_GetTeamBySlug(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	team := dbtest.CreateTeams(t, conn, db.Team{})[0]

	read, err := db.GetTeamBySlug(context.Background(), conn, team.Slug)
	require.NoError(t, err)
	require.Equal(t, team.Name, read.Name)
	require.Equal(t, team.Slug, read.Slug)
}

func Test_GetSingleTeamWithActiveSSO(t *testing.T) {

	t.Run("not found when no team exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		_, err := db.GetSingleTeamWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("not found when only teams without SSO exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		_ = dbtest.CreateTeams(t, conn, db.Team{}, db.Team{})

		_, err := db.GetSingleTeamWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("found single team with active SSO", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		team := dbtest.CreateTeams(t, conn, db.Team{}, db.Team{})[1]
		_ = dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: team.ID,
			Active:         true,
		})[0]

		found, err := db.GetSingleTeamWithActiveSSO(context.Background(), conn)
		require.NoError(t, err)
		require.Equal(t, team.ID, found.ID)
	})

	t.Run("not found single team with inactive SSO", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		team := dbtest.CreateTeams(t, conn, db.Team{}, db.Team{})[1]
		_ = dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: team.ID,
			Active:         false,
		})[0]

		_, err := db.GetSingleTeamWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("not found if two teams with active SSO exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		teams := dbtest.CreateTeams(t, conn, db.Team{}, db.Team{})
		_ = dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{
			OrganizationID: teams[0].ID,
			Active:         true,
		}, db.OIDCClientConfig{
			OrganizationID: teams[1].ID,
			Active:         true,
		})

		_, err := db.GetSingleTeamWithActiveSSO(context.Background(), conn)
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})
}
