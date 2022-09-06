// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

var (
	startOfMay  = time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)
	startOfJune = time.Date(2022, 06, 1, 0, 00, 00, 00, time.UTC)
)

func TestFindStoppedWorkspaceInstancesInRange(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	workspace := dbtest.CreateWorkspaces(t, conn, dbtest.NewWorkspace(t, db.Workspace{}))[0]

	valid := []db.WorkspaceInstance{
		// In the middle of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}),
		// Start of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 05, 1, 1, 00, 00, 00, time.UTC)),
		}),
		// End of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 05, 31, 23, 59, 59, 999999, time.UTC)),
		}),
		// Started in April, but continued into May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 04, 30, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 05, 1, 0, 0, 0, 0, time.UTC)),
		}),
	}
	invalid := []db.WorkspaceInstance{
		// Started in April, no stop time, still running
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarcharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
		}),
		// Started in May, but continued into June
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Started in April, but continued into June (ran for all of May)
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Start of June
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 06, 1, 00, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
	}

	var all []db.WorkspaceInstance
	all = append(all, valid...)
	all = append(all, invalid...)

	dbtest.CreateWorkspaceInstances(t, conn, all...)

	retrieved := dbtest.FindStoppedWorkspaceInstancesInRange(t, conn, startOfMay, startOfJune, workspace.ID)

	require.Len(t, retrieved, len(valid))
}

func TestAttributionID_Values(t *testing.T) {
	scenarios := []struct {
		Input          string
		ExpectedEntity string
		ExpectedID     string
	}{
		{Input: "team:123", ExpectedEntity: db.AttributionEntity_Team, ExpectedID: "123"},
		{Input: "user:123", ExpectedEntity: db.AttributionEntity_User, ExpectedID: "123"},
		{Input: "user:123:invalid", ExpectedEntity: "", ExpectedID: ""},
		{Input: "invalid:123:", ExpectedEntity: "", ExpectedID: ""},
		{Input: "", ExpectedEntity: "", ExpectedID: ""},
	}

	for _, s := range scenarios {
		t.Run(fmt.Sprintf("attribution in: %s, expecting: %s %s", s.Input, s.ExpectedEntity, s.ExpectedID), func(t *testing.T) {
			entity, id := db.AttributionID(s.Input).Values()
			require.Equal(t, s.ExpectedEntity, entity)
			require.Equal(t, s.ExpectedID, id)
		})
	}
}

func TestFindRunningWorkspace(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	workspace := dbtest.CreateWorkspaces(t, conn, dbtest.NewWorkspace(t, db.Workspace{}))[0]

	all := []db.WorkspaceInstance{
		// one stopped instance
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}),
		// Two running instances
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarcharTime(time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)),
		}),
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarcharTime(time.Date(2022, 04, 30, 23, 00, 00, 00, time.UTC)),
		}),
	}

	dbtest.CreateWorkspaceInstances(t, conn, all...)

	retrieved := dbtest.FindRunningWorkspaceInstances(t, conn, workspace.ID)

	require.Equal(t, 2, len(retrieved))
	for _, ws := range retrieved {
		require.False(t, ws.StoppingTime.IsSet())
	}

}

func TestFindWorkspacesByInstanceId(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	workspace := dbtest.CreateWorkspaces(t, conn, dbtest.NewWorkspace(t, db.Workspace{}))[0]

	all := []db.WorkspaceInstance{
		// one stopped instance
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarcharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}),
		// Two running instances
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarcharTime(time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)),
		}),
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarcharTime(time.Date(2022, 04, 30, 23, 00, 00, 00, time.UTC)),
		}),
	}

	twoIds := []uuid.UUID{all[0].ID, all[1].ID}

	dbtest.CreateWorkspaceInstances(t, conn, all...)

	retrieved, err := db.FindWorkspaceInstancesByIds(context.Background(), conn, twoIds)
	require.NoError(t, err)

	require.Equal(t, 2, len(retrieved))
	for _, ws := range retrieved {
		require.NotEqual(t, all[2].ID, ws.ID)
	}

}
