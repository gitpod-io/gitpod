// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

var (
	startOfMay  = time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)
	startOfJune = time.Date(2022, 06, 1, 0, 00, 00, 00, time.UTC)
)

func TestListWorkspaceInstancesInRange(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	workspace := dbtest.CreateWorkspaces(t, conn, dbtest.NewWorkspace(t, db.Workspace{}))[0]

	valid := []db.WorkspaceInstance{
		// In the middle of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}),
		// Start of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 05, 1, 1, 00, 00, 00, time.UTC)),
		}),
		// End of May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 05, 31, 23, 59, 59, 999999, time.UTC)),
		}),
		// Started in April, but continued into May
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 04, 30, 23, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 04, 30, 23, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 05, 1, 0, 0, 0, 0, time.UTC)),
		}),
		// Started in May, but continued into June
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Started in April, but continued into June (ran for all of May)
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Stopped in May, no creation time, should be retrieved but this is a poor data quality record.
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:          uuid.New(),
			WorkspaceID: workspace.ID,
			StartedTime: db.NewVarcharTime(time.Date(2022, 05, 1, 1, 0, 0, 0, time.UTC)),
			StoppedTime: db.NewVarcharTime(time.Date(2022, 05, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Started in April, no stop time, still running
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 04, 31, 23, 00, 00, 00, time.UTC)),
		}),
	}
	invalid := []db.WorkspaceInstance{
		// Start of June
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 06, 1, 00, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 06, 1, 00, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
	}

	var all []db.WorkspaceInstance
	all = append(all, valid...)
	all = append(all, invalid...)

	dbtest.CreateWorkspaceInstances(t, conn, all...)

	retrieved, err := db.ListWorkspaceInstancesInRange(context.Background(), conn, startOfMay, startOfJune)
	require.NoError(t, err)

	require.Len(t, retrieved, len(valid))
}

func TestListWorkspaceInstancesInRange_Fields(t *testing.T) {

	t.Run("no project results in empty string", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		workspace := dbtest.CreateWorkspaces(t, conn, dbtest.NewWorkspace(t, db.Workspace{}))[0]
		instance := dbtest.CreateWorkspaceInstances(t, conn, dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}))[0]

		retrieved, err := db.ListWorkspaceInstancesInRange(context.Background(), conn, startOfMay, startOfJune)
		require.NoError(t, err)

		require.Len(t, retrieved, 1)
		require.Equal(t, db.WorkspaceInstanceForUsage{
			ID:                 instance.ID,
			WorkspaceID:        instance.WorkspaceID,
			OwnerID:            workspace.OwnerID,
			ProjectID:          sql.NullString{},
			WorkspaceClass:     instance.WorkspaceClass,
			Type:               workspace.Type,
			UsageAttributionID: instance.UsageAttributionID,
			CreationTime:       instance.CreationTime,
			StoppedTime:        instance.StoppedTime,
		}, retrieved[0])
	})

	t.Run("with project", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		workspace := dbtest.CreateWorkspaces(t, conn, dbtest.NewWorkspace(t, db.Workspace{
			ProjectID: sql.NullString{
				String: uuid.New().String(),
				Valid:  true,
			},
		}))[0]
		instance := dbtest.CreateWorkspaceInstances(t, conn, dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			WorkspaceID:  workspace.ID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}))[0]

		retrieved, err := db.ListWorkspaceInstancesInRange(context.Background(), conn, startOfMay, startOfJune)
		require.NoError(t, err)

		require.Len(t, retrieved, 1)
		require.Equal(t, db.WorkspaceInstanceForUsage{
			ID:          instance.ID,
			WorkspaceID: instance.WorkspaceID,
			OwnerID:     workspace.OwnerID,
			ProjectID: sql.NullString{
				String: workspace.ProjectID.String,
				Valid:  true,
			},
			WorkspaceClass:     instance.WorkspaceClass,
			Type:               workspace.Type,
			UsageAttributionID: instance.UsageAttributionID,
			CreationTime:       instance.CreationTime,
			StoppedTime:        instance.StoppedTime,
		}, retrieved[0])
	})

}

func TestListWorkspaceInstancesInRange_InBatches(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	workspaceID := dbtest.GenerateWorkspaceID()
	var instances []db.WorkspaceInstance
	for i := 0; i < 1100; i++ {
		instances = append(instances, dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:           uuid.New(),
			WorkspaceID:  workspaceID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StartedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 12, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 05, 15, 13, 00, 00, 00, time.UTC)),
		}))

	}

	dbtest.CreateWorkspaceInstances(t, conn, instances...)

	results, err := db.ListWorkspaceInstancesInRange(context.Background(), conn, startOfMay, startOfJune)
	require.NoError(t, err)
	require.Len(t, results, len(instances))
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
