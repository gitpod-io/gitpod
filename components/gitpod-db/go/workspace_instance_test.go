// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"

	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
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
			StartedTime:  db.NewVarCharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}),
		// Start of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarCharTime(time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 05, 1, 1, 00, 00, 00, time.UTC)),
		}),
		// End of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarCharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 05, 31, 23, 59, 59, 999999, time.UTC)),
		}),
		// Started in April, but continued into May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarCharTime(time.Date(2022, 04, 30, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 05, 1, 0, 0, 0, 0, time.UTC)),
		}),
	}
	invalid := []db.WorkspaceInstance{
		// Started in April, no stop time, still running
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarCharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
		}),
		// Started in May, but continued into June
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarCharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Started in April, but continued into June (ran for all of May)
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarCharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Start of June
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarCharTime(time.Date(2022, 06, 1, 00, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
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
		{Input: "team:123", ExpectedEntity: "team", ExpectedID: "123"},
		{Input: "user:123", ExpectedEntity: "", ExpectedID: ""},
		{Input: "foo:123", ExpectedEntity: "", ExpectedID: ""},
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
	now := time.Now()
	fiveMinAgo := now.Add(-5 * time.Minute)
	tenMinAgo := now.Add(-10 * time.Minute)
	moreThan10DaysAgo := now.Add(-11 * 24 * time.Hour)

	all := []db.WorkspaceInstance{
		// one stopped instance
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:  workspace.ID,
			StartedTime:  db.NewVarCharTime(tenMinAgo),
			StoppingTime: db.NewVarCharTime(fiveMinAgo),
		}),
		// one unstopped before 10 days ago
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:    workspace.ID,
			StartedTime:    db.NewVarCharTime(moreThan10DaysAgo),
			PhasePersisted: "running",
		}),
		// Two running instances
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:             uuid.New(),
			WorkspaceID:    workspace.ID,
			StartedTime:    db.NewVarCharTime(tenMinAgo),
			PhasePersisted: "running",
		}),
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:             uuid.New(),
			WorkspaceID:    workspace.ID,
			StartedTime:    db.NewVarCharTime(tenMinAgo),
			PhasePersisted: "running",
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
			StartedTime:  db.NewVarCharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppingTime: db.NewVarCharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}),
		// Two running instances
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarCharTime(time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)),
		}),
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarCharTime(time.Date(2022, 04, 30, 23, 00, 00, 00, time.UTC)),
		}),
	}

	twoIds := []string{all[0].ID.String(), all[1].ID.String()}

	dbtest.CreateWorkspaceInstances(t, conn, all...)

	retrieved, err := db.FindWorkspaceInstancesByIds(context.Background(), conn, twoIds)
	require.NoError(t, err)

	require.Equal(t, 2, len(retrieved))
	for _, ws := range retrieved {
		require.NotEqual(t, all[2].ID, ws.ID)
	}

}

func TestListWorkspaceInstanceIDsWithPhaseStoppedButNoStoppingTime(t *testing.T) {
	dbconn := dbtest.ConnectForTests(t)
	instances := dbtest.CreateWorkspaceInstances(t, dbconn,
		// started but not stopped, should be ignored
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			StartedTime: db.NewVarCharTime(time.Now()),
		}),
		// stopped, but no stopping time, should be detected
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			StartedTime:    db.NewVarCharTime(time.Now()),
			PhasePersisted: "stopped",
		}),
	)

	dbtest.CreateUsageRecords(t, dbconn,
		dbtest.NewUsage(t, db.Usage{
			ID: instances[0].ID,
		}),
		dbtest.NewUsage(t, db.Usage{
			ID: instances[1].ID,
		}),
	)

	detectedIDs, err := db.ListWorkspaceInstanceIDsWithPhaseStoppedButNoStoppingTime(context.Background(), dbconn)
	require.NoError(t, err)
	require.Equal(t, []uuid.UUID{instances[1].ID}, detectedIDs)
}
