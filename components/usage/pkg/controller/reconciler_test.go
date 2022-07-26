// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"database/sql"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"google.golang.org/grpc"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestUsageReconciler_ReconcileTimeRange(t *testing.T) {
	startOfMay := time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)
	startOfJune := time.Date(2022, 06, 1, 0, 00, 00, 00, time.UTC)

	teamID := uuid.New()
	scenarioRunTime := time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)

	instances := []db.WorkspaceInstance{
		// Ran throughout the reconcile period
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:                 uuid.New(),
			UsageAttributionID: db.NewTeamAttributionID(teamID.String()),
			CreationTime:       db.NewVarcharTime(time.Date(2022, 05, 1, 00, 00, 00, 00, time.UTC)),
			StartedTime:        db.NewVarcharTime(time.Date(2022, 05, 1, 00, 00, 00, 00, time.UTC)),
			StoppedTime:        db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
		// Still running
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:                 uuid.New(),
			UsageAttributionID: db.NewTeamAttributionID(teamID.String()),
			CreationTime:       db.NewVarcharTime(time.Date(2022, 05, 30, 00, 00, 00, 00, time.UTC)),
			StartedTime:        db.NewVarcharTime(time.Date(2022, 05, 30, 00, 00, 00, 00, time.UTC)),
		}),
		// No creation time, invalid record
		dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
			ID:                 uuid.New(),
			UsageAttributionID: db.NewTeamAttributionID(teamID.String()),
			StartedTime:        db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
			StoppedTime:        db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
	}

	conn := dbtest.ConnectForTests(t)
	dbtest.CreateWorkspaceInstances(t, conn, instances...)

	reconciler := &UsageReconciler{
		billingService: &NoOpBillingServiceClient{},
		nowFunc:        func() time.Time { return scenarioRunTime },
		conn:           conn,
		pricer:         DefaultWorkspacePricer,
	}
	status, report, err := reconciler.ReconcileTimeRange(context.Background(), startOfMay, startOfJune)
	require.NoError(t, err)

	require.Len(t, report, 2)
	require.Equal(t, &UsageReconcileStatus{
		StartTime:                 startOfMay,
		EndTime:                   startOfJune,
		WorkspaceInstances:        2,
		InvalidWorkspaceInstances: 1,
	}, status)
}

type NoOpBillingServiceClient struct{}

func (c *NoOpBillingServiceClient) UpdateInvoices(ctx context.Context, in *v1.UpdateInvoicesRequest, opts ...grpc.CallOption) (*v1.UpdateInvoicesResponse, error) {
	return &v1.UpdateInvoicesResponse{}, nil
}

func TestInstanceToUsageRecords(t *testing.T) {
	maxStopTime := time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)
	teamID, ownerID, projectID := uuid.New().String(), uuid.New(), uuid.New()
	workspaceID := dbtest.GenerateWorkspaceID()
	teamAttributionID := db.NewTeamAttributionID(teamID)
	instanceId := uuid.New()
	creationTime := db.NewVarcharTime(time.Date(2022, 05, 30, 00, 00, 00, 00, time.UTC))
	stoppedTime := db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC))

	scenarios := []struct {
		Name     string
		Records  []db.WorkspaceInstanceForUsage
		Expected []db.WorkspaceInstanceUsage
	}{
		{
			Name: "a stopped workspace instance",
			Records: []db.WorkspaceInstanceForUsage{
				{
					ID:                 instanceId,
					WorkspaceID:        workspaceID,
					OwnerID:            ownerID,
					ProjectID:          sql.NullString{},
					WorkspaceClass:     defaultWorkspaceClass,
					Type:               db.WorkspaceType_Prebuild,
					UsageAttributionID: teamAttributionID,
					CreationTime:       creationTime,
					StoppedTime:        stoppedTime,
				},
			},
			Expected: []db.WorkspaceInstanceUsage{{
				InstanceID:     instanceId,
				AttributionID:  teamAttributionID,
				UserID:         ownerID,
				WorkspaceID:    workspaceID,
				ProjectID:      "",
				WorkspaceType:  db.WorkspaceType_Prebuild,
				WorkspaceClass: defaultWorkspaceClass,
				CreditsUsed:    470,
				StartedAt:      creationTime.Time(),
				StoppedAt:      sql.NullTime{Time: stoppedTime.Time(), Valid: true},
				GenerationID:   0,
				Deleted:        false,
			}},
		},
		{
			Name: "workspace instance that is still running",
			Records: []db.WorkspaceInstanceForUsage{
				{
					ID:                 instanceId,
					OwnerID:            ownerID,
					ProjectID:          sql.NullString{String: projectID.String(), Valid: true},
					WorkspaceClass:     defaultWorkspaceClass,
					Type:               db.WorkspaceType_Regular,
					WorkspaceID:        workspaceID,
					UsageAttributionID: teamAttributionID,
					CreationTime:       creationTime,
					StoppedTime:        db.VarcharTime{},
				},
			},
			Expected: []db.WorkspaceInstanceUsage{{
				InstanceID:     instanceId,
				AttributionID:  teamAttributionID,
				UserID:         ownerID,
				ProjectID:      projectID.String(),
				WorkspaceID:    workspaceID,
				WorkspaceType:  db.WorkspaceType_Regular,
				StartedAt:      creationTime.Time(),
				StoppedAt:      sql.NullTime{},
				WorkspaceClass: defaultWorkspaceClass,
				CreditsUsed:    470,
			}},
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			actual := instancesToUsageRecords(s.Records, DefaultWorkspacePricer, maxStopTime)
			require.Equal(t, s.Expected, actual)
		})
	}
}
