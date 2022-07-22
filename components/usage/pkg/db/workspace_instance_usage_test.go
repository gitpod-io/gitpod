// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestCreateUsageRecords_Updates(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	instanceID := uuid.New()
	teamID := uuid.New().String()
	teamAttributionID := db.NewTeamAttributionID(teamID)
	start := time.Date(2022, 7, 19, 21, 11, 12, 5000, time.UTC)
	stop := time.Date(2022, 7, 19, 21, 9, 12, 5000, time.UTC)
	record := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		InstanceID:    instanceID,
		AttributionID: teamAttributionID,
		StartedAt:     start,
		StoppedAt: sql.NullTime{
			Time:  stop,
			Valid: true,
		},
	})

	require.NoError(t, db.CreateUsageRecords(context.Background(), conn, []db.WorkspaceInstanceUsage{record}))

	// time is changed
	updatedStart := time.Date(2022, 7, 19, 20, 55, 12, 5000, time.UTC)
	updatedStop := time.Date(2022, 7, 19, 21, 55, 12, 5000, time.UTC)
	update := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		InstanceID:     instanceID,
		AttributionID:  teamAttributionID,
		UserID:         uuid.New(),
		WorkspaceID:    dbtest.GenerateWorkspaceID(),
		ProjectID:      uuid.New().String(),
		WorkspaceType:  db.WorkspaceType_Prebuild,
		WorkspaceClass: db.WorkspaceClass_Default,
		CreditsUsed:    9,
		StartedAt:      updatedStart,
		StoppedAt: sql.NullTime{
			Time:  updatedStop,
			Valid: true,
		},
	})

	require.NoError(t, db.CreateUsageRecords(context.Background(), conn, []db.WorkspaceInstanceUsage{update}))
	t.Cleanup(func() {
		conn.Model(&db.WorkspaceInstanceUsage{}).Delete(update)
	})

	list, err := db.ListUsage(context.Background(), conn, teamAttributionID, time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC), time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC), db.DescendingOrder)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, update, list[0])
}

func TestListUsage_Ordering(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
	newest := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: teamAttributionID,
		StartedAt:     time.Date(2022, 7, 15, 10, 30, 30, 5000, time.UTC),
		// not stopped
	})

	oldest := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: teamAttributionID,
		StartedAt:     time.Date(2022, 7, 14, 10, 30, 30, 5000, time.UTC),
		StoppedAt: sql.NullTime{
			Time:  time.Date(2022, 7, 15, 15, 30, 30, 5000, time.UTC),
			Valid: true,
		},
	})

	instances := []db.WorkspaceInstanceUsage{newest, oldest}
	require.NoError(t, db.CreateUsageRecords(context.Background(), conn, instances))

	t.Cleanup(func() {
		conn.Model(&db.WorkspaceInstanceUsage{}).Delete(instances)
	})

	listed, err := db.ListUsage(context.Background(), conn, teamAttributionID, time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC), time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC), db.AscendingOrder)
	require.NoError(t, err)

	require.Equal(t, []db.WorkspaceInstanceUsage{oldest, newest}, listed)
}

func TestListUsageInRange(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC)

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	// started and finished before our query range, should be excluded
	startBeforeFinishBefore := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     start.Add(-1 * 24 * time.Hour),
		StoppedAt: sql.NullTime{
			Time:  start.Add(-1 * 23 * time.Hour),
			Valid: true,
		},
	})

	// started before, but finished inside our query range
	startBeforeFinishInside := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     start.Add(-1 * time.Hour),
		StoppedAt: sql.NullTime{
			Time:  start.Add(2 * time.Hour),
			Valid: true,
		},
	})

	// started inside query range, and also finished inside query range
	startInsideFinishInside := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     start.Add(3 * time.Hour),
		StoppedAt: sql.NullTime{
			Time:  start.Add(5 * time.Hour),
			Valid: true,
		},
	})

	// started inside query range, and finished after
	startedInsideFinishedOutside := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     end.Add(-1 * time.Hour),
		StoppedAt: sql.NullTime{
			Time:  end.Add(2 * time.Hour),
			Valid: true,
		},
	})
	// started after query range, finished after - should be excluded
	startedOutsideFinishedOutside := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     end.Add(time.Hour),
		StoppedAt: sql.NullTime{
			Time:  end.Add(2 * time.Hour),
			Valid: true,
		},
	})

	// started before query, still running
	startedBeforeAndStillRunning := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     start.Add(-24 * time.Hour),
	})

	startedInsideAndStillRunning := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     start.Add(24 * time.Hour),
	})

	instances := []db.WorkspaceInstanceUsage{startBeforeFinishBefore, startBeforeFinishInside, startInsideFinishInside, startedInsideFinishedOutside, startedOutsideFinishedOutside, startedBeforeAndStillRunning, startedInsideAndStillRunning}
	dbtest.CreateWorkspaceInstanceUsageRecords(t, conn, instances...)

	results, err := db.ListUsage(context.Background(), conn, attributionID, start, end, db.DescendingOrder)
	require.NoError(t, err)

	require.Len(t, results, 5)
	require.Equal(t, []db.WorkspaceInstanceUsage{
		startedInsideFinishedOutside, startedInsideAndStillRunning, startInsideFinishInside, startBeforeFinishInside, startedBeforeAndStillRunning,
	}, results)
}
