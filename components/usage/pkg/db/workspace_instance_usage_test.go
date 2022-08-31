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

	listResult, err := db.ListUsage(context.Background(), conn, teamAttributionID, time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC), time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC), db.DescendingOrder, int64(0), int64(100))
	require.NoError(t, err)
	if err == nil {

	}
	require.Len(t, listResult.UsageRecords, 1)
	require.Equal(t, int64(1), listResult.Count)
	require.Equal(t, update, listResult.UsageRecords[0])
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

	listResult, err := db.ListUsage(context.Background(), conn, teamAttributionID, time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC), time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC), db.AscendingOrder, int64(0), int64(100))
	require.NoError(t, err)

	require.Equal(t, []db.WorkspaceInstanceUsage{oldest, newest}, listResult.UsageRecords)
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

	// started inside query range, and also finished inside query range
	startInsideFinishInsideButDifferentAttributionID := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: db.NewTeamAttributionID(uuid.New().String()),
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

	instances := []db.WorkspaceInstanceUsage{startBeforeFinishBefore, startBeforeFinishInside, startInsideFinishInside, startInsideFinishInsideButDifferentAttributionID, startedInsideFinishedOutside, startedOutsideFinishedOutside, startedBeforeAndStillRunning, startedInsideAndStillRunning}
	dbtest.CreateWorkspaceInstanceUsageRecords(t, conn, instances...)

	listResult, err := db.ListUsage(context.Background(), conn, attributionID, start, end, db.DescendingOrder, int64(0), int64(100))
	require.NoError(t, err)

	require.Len(t, listResult.UsageRecords, 5)
	require.Equal(t, []db.WorkspaceInstanceUsage{
		startedInsideFinishedOutside, startedInsideAndStillRunning, startInsideFinishInside, startBeforeFinishInside, startedBeforeAndStillRunning,
	}, listResult.UsageRecords)
}

func TestListUsagePagination(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC)

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	// started inside query range, and also finished inside query range
	startInsideFinishInside := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
		AttributionID: attributionID,
		StartedAt:     start.Add(3 * time.Hour),
		StoppedAt: sql.NullTime{
			Time:  start.Add(5 * time.Hour),
			Valid: true,
		},
		CreditsUsed: float64(2),
	})

	var instances []db.WorkspaceInstanceUsage
	for i := 0; i < 122; i++ {
		startInsideFinishInside.InstanceID = uuid.New()
		instances = append(instances, startInsideFinishInside)
	}
	dbtest.CreateWorkspaceInstanceUsageRecords(t, conn, instances...)

	listResult, err := db.ListUsage(context.Background(), conn, attributionID, start, end, db.DescendingOrder, int64(100), int64(50))
	require.NoError(t, err)

	require.Len(t, listResult.UsageRecords, 22)
	require.Equal(t, float64(244), listResult.TotalCreditsUsed)
	require.Equal(t, int64(122), listResult.Count)
}
