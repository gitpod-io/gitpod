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

func Test_WriteRead(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	team := db.Team{
		ID:   uuid.New(),
		Name: "Team1",
		Slug: "team1",
	}

	_, err := db.CreateTeam(context.Background(), conn, team)
	require.NoError(t, err)

	candidates := []db.Team{
		{ID: team.ID},
		{Slug: team.Slug},
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

	team := db.Team{
		ID:   uuid.New(),
		Name: "Team1",
		Slug: "team1",
	}

	_, err := db.CreateTeam(context.Background(), conn, team)
	require.NoError(t, err)

	read, err := db.GetTeamBySlug(context.Background(), conn, team.Slug)
	require.NoError(t, err)
	require.Equal(t, team.Name, read.Name)
	require.Equal(t, team.Slug, read.Slug)
}

func Test_GetTheSingleTeam(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	conn.Delete(&db.Team{}, "1=1")

	_, err := db.GetTheSingleTeam(context.Background(), conn)
	require.Error(t, err)

	// create a single team
	team := db.Team{
		ID:   uuid.New(),
		Name: "Team1",
		Slug: "team1",
	}

	_, err = db.CreateTeam(context.Background(), conn, team)
	require.NoError(t, err)

	read, err := db.GetTheSingleTeam(context.Background(), conn)
	require.NoError(t, err)
	require.Equal(t, team.Name, read.Name)
	require.Equal(t, team.Slug, read.Slug)

	// create a second team
	team2 := db.Team{
		ID:   uuid.New(),
		Name: "Team1",
		Slug: "team1",
	}

	_, err = db.CreateTeam(context.Background(), conn, team2)
	require.NoError(t, err)

	_, err = db.GetTheSingleTeam(context.Background(), conn)
	require.Error(t, err)
}
