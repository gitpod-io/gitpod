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

func TestCanCreateUsageRecords(t *testing.T) {
	teamID := uuid.New().String()
	teamAttributionID := db.NewTeamAttributionID(teamID)
	instanceID := uuid.New()
	ctx := context.Background()

	scenarios := []struct {
		Name         string
		UsageRecords []db.WorkspaceInstanceUsage
	}{
		{
			Name: "One workspace instance",
			UsageRecords: []db.WorkspaceInstanceUsage{{
				InstanceID:    instanceID,
				AttributionID: teamAttributionID,
				StartedAt:     time.Now(),
				StoppedAt:     sql.NullTime{},
				CreditsUsed:   0,
				GenerationID:  0,
			}},
		},
	}

	for _, scenario := range scenarios {
		conn := dbtest.ConnectForTests(t)
		t.Run(scenario.Name, func(t *testing.T) {
			t.Cleanup(func() {
				require.NoError(t, conn.Where(instanceID).Delete(&db.WorkspaceInstanceUsage{}).Error)
			})

			require.NoError(t, db.CreateUsageRecords(ctx, conn, scenario.UsageRecords))
		})
	}
}

func TestNoErrorOnCreatingDuplicateRecords(t *testing.T) {
	teamID := uuid.New().String()
	teamAttributionID := db.NewTeamAttributionID(teamID)
	instanceID := uuid.New()
	instanceStartTime := time.Now()
	ctx := context.Background()

	scenarios := []struct {
		Name         string
		UsageRecords []db.WorkspaceInstanceUsage
	}{
		{
			Name: "The same instance twice",
			UsageRecords: []db.WorkspaceInstanceUsage{
				{
					InstanceID:    instanceID,
					AttributionID: teamAttributionID,
					StartedAt:     instanceStartTime,
					StoppedAt:     sql.NullTime{},
					CreditsUsed:   0,
					GenerationID:  0,
				},
				{
					InstanceID:    instanceID,
					AttributionID: teamAttributionID,
					StartedAt:     instanceStartTime,
					StoppedAt:     sql.NullTime{},
					CreditsUsed:   0,
					GenerationID:  0,
				},
			},
		},
	}

	for _, scenario := range scenarios {
		conn := dbtest.ConnectForTests(t)
		t.Run(scenario.Name, func(t *testing.T) {
			t.Cleanup(func() {
				require.NoError(t, conn.Where(instanceID).Delete(&db.WorkspaceInstanceUsage{}).Error)
			})

			require.NoError(t, db.CreateUsageRecords(ctx, conn, scenario.UsageRecords))
		})
	}
}

func TestCreateUsageRecords_Updates(t *testing.T) {
	conn := dbtest.ConnectForTests(t).Debug()

	instanceID := uuid.New()
	teamID := uuid.New().String()
	teamAttributionID := db.NewTeamAttributionID(teamID)
	start := time.Date(2022, 7, 19, 21, 11, 12, 5000, time.UTC)
	stop := time.Date(2022, 7, 19, 21, 9, 12, 5000, time.UTC)
	record := db.WorkspaceInstanceUsage{
		InstanceID:     instanceID,
		AttributionID:  teamAttributionID,
		UserID:         uuid.New(),
		WorkspaceID:    dbtest.GenerateWorkspaceID(),
		ProjectID:      uuid.New().String(),
		WorkspaceType:  db.WorkspaceType_Prebuild,
		WorkspaceClass: db.WorkspaceClass_Default,
		CreditsUsed:    4.505,
		StartedAt:      start,
		StoppedAt: sql.NullTime{
			Time:  stop,
			Valid: true,
		},
	}

	require.NoError(t, db.CreateUsageRecords(context.Background(), conn, []db.WorkspaceInstanceUsage{record}))

	// time is changed
	updatedStart := time.Date(2022, 7, 19, 20, 55, 12, 5000, time.UTC)
	updatedStop := time.Date(2022, 7, 19, 21, 55, 12, 5000, time.UTC)
	update := db.WorkspaceInstanceUsage{
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
	}

	require.NoError(t, db.CreateUsageRecords(context.Background(), conn, []db.WorkspaceInstanceUsage{update}))

	list, err := db.ListUsage(context.Background(), conn, teamAttributionID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, update, list[0])
}
