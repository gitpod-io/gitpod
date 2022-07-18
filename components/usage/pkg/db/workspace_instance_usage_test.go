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
				GenerationId:  0,
				Deleted:       false,
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
					GenerationId:  0,
					Deleted:       false,
				},
				{
					InstanceID:    instanceID,
					AttributionID: teamAttributionID,
					StartedAt:     instanceStartTime,
					StoppedAt:     sql.NullTime{},
					CreditsUsed:   0,
					GenerationId:  0,
					Deleted:       false,
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
