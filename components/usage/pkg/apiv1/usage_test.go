// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"database/sql"
	"reflect"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestUsageService_ListBilledUsage(t *testing.T) {
	ctx := context.Background()

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	type Expectation struct {
		Code        codes.Code
		InstanceIds []string
	}

	type Scenario struct {
		name      string
		Instances []db.WorkspaceInstanceUsage
		Request   *v1.ListBilledUsageRequest
		Expect    Expectation
	}

	scenarios := []Scenario{
		{
			name:      "fails when From is after To",
			Instances: nil,
			Request: &v1.ListBilledUsageRequest{
				AttributionId: string(attributionID),
				From:          timestamppb.New(time.Date(2022, 07, 1, 13, 0, 0, 0, time.UTC)),
				To:            timestamppb.New(time.Date(2022, 07, 1, 12, 0, 0, 0, time.UTC)),
			},
			Expect: Expectation{
				Code:        codes.InvalidArgument,
				InstanceIds: nil,
			},
		},
		{
			name:      "fails when time range is greater than 31 days",
			Instances: nil,
			Request: &v1.ListBilledUsageRequest{
				AttributionId: string(attributionID),
				From:          timestamppb.New(time.Date(2022, 7, 1, 13, 0, 0, 0, time.UTC)),
				To:            timestamppb.New(time.Date(2022, 8, 1, 13, 0, 1, 0, time.UTC)),
			},
			Expect: Expectation{
				Code:        codes.InvalidArgument,
				InstanceIds: nil,
			},
		},
		(func() Scenario {
			start := time.Date(2022, 07, 1, 13, 0, 0, 0, time.UTC)
			attrID := db.NewTeamAttributionID(uuid.New().String())
			var instances []db.WorkspaceInstanceUsage
			for i := 0; i < 4; i++ {
				instance := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
					AttributionID: attrID,
					StartedAt:     start.Add(time.Duration(i) * 24 * time.Hour),
					StoppedAt: sql.NullTime{
						Time:  start.Add(time.Duration(i)*24*time.Hour + time.Hour),
						Valid: true,
					},
				})
				instances = append(instances, instance)
			}

			return Scenario{
				name:      "filters results to specified time range, ascending",
				Instances: instances,
				Request: &v1.ListBilledUsageRequest{
					AttributionId: string(attrID),
					From:          timestamppb.New(start),
					To:            timestamppb.New(start.Add(3 * 24 * time.Hour)),
					Order:         v1.ListBilledUsageRequest_ORDERING_ASCENDING,
				},
				Expect: Expectation{
					Code:        codes.OK,
					InstanceIds: []string{instances[0].InstanceID.String(), instances[1].InstanceID.String(), instances[2].InstanceID.String()},
				},
			}
		})(),
		(func() Scenario {
			start := time.Date(2022, 07, 1, 13, 0, 0, 0, time.UTC)
			attrID := db.NewTeamAttributionID(uuid.New().String())
			var instances []db.WorkspaceInstanceUsage
			var instanceIDs []string
			for i := 0; i < 3; i++ {
				instance := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
					AttributionID: attrID,
					StartedAt:     start.Add(time.Duration(i) * 24 * time.Hour),
					StoppedAt: sql.NullTime{
						Time:  start.Add(time.Duration(i)*24*time.Hour + time.Hour),
						Valid: true,
					},
				})
				instances = append(instances, instance)

				instanceIDs = append(instanceIDs, instance.InstanceID.String())
			}

			return Scenario{
				name:      "filters results to specified time range, descending",
				Instances: instances,
				Request: &v1.ListBilledUsageRequest{
					AttributionId: string(attrID),
					From:          timestamppb.New(start),
					To:            timestamppb.New(start.Add(5 * 24 * time.Hour)),
					Order:         v1.ListBilledUsageRequest_ORDERING_DESCENDING,
				},
				Expect: Expectation{
					Code:        codes.OK,
					InstanceIds: []string{instances[2].InstanceID.String(), instances[1].InstanceID.String(), instances[0].InstanceID.String()},
				},
			}
		})(),
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			dbconn := dbtest.ConnectForTests(t)
			dbtest.CreateWorkspaceInstanceUsageRecords(t, dbconn, scenario.Instances...)

			srv := baseserver.NewForTests(t,
				baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
			)

			generator := NewReportGenerator(dbconn, DefaultWorkspacePricer)
			v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService(dbconn, generator, nil))
			baseserver.StartServerForTests(t, srv)

			conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
			require.NoError(t, err)

			client := v1.NewUsageServiceClient(conn)

			resp, err := client.ListBilledUsage(ctx, scenario.Request)
			require.Equal(t, scenario.Expect.Code, status.Code(err))

			if err != nil {
				return
			}

			var instanceIds []string
			for _, billedSession := range resp.Sessions {
				instanceIds = append(instanceIds, billedSession.InstanceId)
			}

			require.Equal(t, scenario.Expect.InstanceIds, instanceIds)
		})
	}
}

func TestInstanceToUsageRecords(t *testing.T) {
	maxStopTime := time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)
	teamID, ownerID, projectID := uuid.New().String(), uuid.New(), uuid.New()
	workspaceID := dbtest.GenerateWorkspaceID()
	teamAttributionID := db.NewTeamAttributionID(teamID)
	instanceId := uuid.New()
	creationTime := db.NewVarcharTime(time.Date(2022, 05, 30, 00, 00, 00, 00, time.UTC))
	startedTime := db.NewVarcharTime(time.Date(2022, 05, 30, 00, 00, 00, 00, time.UTC))
	stoppingTime := db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC))
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
					StartedTime:        startedTime,
					StoppingTime:       stoppingTime,
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
				StartedAt:      startedTime.Time(),
				StoppedAt:      sql.NullTime{Time: stoppingTime.Time(), Valid: true},
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
					StartedTime:        startedTime,
					StoppingTime:       db.VarcharTime{},
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

func TestReportGenerator_GenerateUsageReport(t *testing.T) {
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
			StoppingTime:       db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
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
			StoppingTime:       db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
			StoppedTime:        db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
		}),
	}

	conn := dbtest.ConnectForTests(t)
	dbtest.CreateWorkspaceInstances(t, conn, instances...)

	nowFunc := func() time.Time { return scenarioRunTime }
	generator := &ReportGenerator{
		nowFunc: nowFunc,
		conn:    conn,
		pricer:  DefaultWorkspacePricer,
	}

	report, err := generator.GenerateUsageReport(context.Background(), startOfMay, startOfJune)
	require.NoError(t, err)

	require.Equal(t, nowFunc(), report.GenerationTime)
	require.Equal(t, startOfMay, report.From)
	// require.Equal(t, startOfJune, report.To) TODO(gpl) This is not true anymore - does it really make sense to test for it?
	require.Len(t, report.RawSessions, 3)
	require.Len(t, report.InvalidSessions, 1)
	require.Len(t, report.UsageRecords, 2)
}

func TestReportGenerator_GenerateUsageReportTable(t *testing.T) {
	teamID := uuid.New()
	instanceID := uuid.New()

	Must := func(ti db.VarcharTime, err error) db.VarcharTime {
		if err != nil {
			t.Fatal(err)
		}
		return ti
	}
	Timestamp := func(timestampAsStr string) db.VarcharTime {
		return Must(db.NewVarcharTimeFromStr(timestampAsStr))
	}
	type Expectation struct {
		custom       *func(t *testing.T, report *UsageReport)
		usageRecords []db.WorkspaceInstanceUsage
	}

	type TestCase struct {
		name        string
		from        time.Time
		to          time.Time
		runtime     time.Time
		instances   []db.WorkspaceInstance
		expectation Expectation
	}
	tests := []TestCase{
		{
			name:    "real example taken from DB: runtime _before_ instance.startedTime",
			from:    time.Date(2022, 8, 1, 0, 00, 00, 00, time.UTC),
			to:      time.Date(2022, 9, 1, 0, 00, 00, 00, time.UTC),
			runtime: Timestamp("2022-08-17T09:38:28Z").Time(),
			instances: []db.WorkspaceInstance{
				dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
					ID:                 instanceID,
					UsageAttributionID: db.NewTeamAttributionID(teamID.String()),
					CreationTime:       Timestamp("2022-08-17T09:40:47.316Z"),
					StartedTime:        Timestamp("2022-08-17T09:40:53.115Z"),
					StoppingTime:       Timestamp("2022-08-17T09:42:36.292Z"),
					StoppedTime:        Timestamp("2022-08-17T09:43:04.874Z"),
				}),
			},
			expectation: Expectation{
				usageRecords: nil,
				// usageRecords: []db.WorkspaceInstanceUsage{
				// 	{
				// 		InstanceID: instanceID,
				// 		AttributionID: db.NewTeamAttributionID(teamID.String()),
				// 		StartedAt: Timestamp("2022-08-17T09:40:53.115Z").Time(),
				// 		StoppedAt: sql.NullTime{ Time: Timestamp("2022-08-17T09:43:04.874Z").Time(), Valid: true },
				// 		WorkspaceClass: "default",
				// 		CreditsUsed: 3.0,
				// 	},
				// },
			},
		},
		{
			name:    "same as above, but with runtime _after_ startedTime",
			from:    time.Date(2022, 8, 1, 0, 00, 00, 00, time.UTC),
			to:      time.Date(2022, 9, 1, 0, 00, 00, 00, time.UTC),
			runtime: Timestamp("2022-08-17T09:41:00Z").Time(),
			instances: []db.WorkspaceInstance{
				dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
					ID:                 instanceID,
					UsageAttributionID: db.NewTeamAttributionID(teamID.String()),
					CreationTime:       Timestamp("2022-08-17T09:40:47.316Z"),
					StartedTime:        Timestamp("2022-08-17T09:40:53.115Z"),
					StoppingTime:       Timestamp("2022-08-17T09:42:36.292Z"),
					StoppedTime:        Timestamp("2022-08-17T09:43:04.874Z"),
				}),
			},
			expectation: Expectation{
				usageRecords: []db.WorkspaceInstanceUsage{
					{
						InstanceID:     instanceID,
						AttributionID:  db.NewTeamAttributionID(teamID.String()),
						StartedAt:      Timestamp("2022-08-17T09:40:53.115Z").Time(),
						StoppedAt:      sql.NullTime{Time: Timestamp("2022-08-17T09:41:00Z").Time(), Valid: true},
						WorkspaceClass: "default",
						CreditsUsed:    0.019444444444444445,
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			conn := dbtest.ConnectForTests(t)
			dbtest.CreateWorkspaceInstances(t, conn, test.instances...)

			nowFunc := func() time.Time { return test.runtime }
			generator := &ReportGenerator{
				nowFunc: nowFunc,
				conn:    conn,
				pricer:  DefaultWorkspacePricer,
			}

			report, err := generator.GenerateUsageReport(context.Background(), test.from, test.to)
			require.NoError(t, err)

			require.Equal(t, test.runtime, report.GenerationTime)
			require.Equal(t, test.from, report.From)
			// require.Equal(t, test.to, report.To) TODO(gpl) This is not true anymore - does it really make sense to test for it?

			// These invariants should always be true:
			// 1. No negative usage
			for _, rec := range report.UsageRecords {
				if rec.CreditsUsed < 0 {
					t.Error("Got report with negative credits!")
				}
			}

			if !reflect.DeepEqual(test.expectation.usageRecords, report.UsageRecords) {
				t.Errorf("report.UsageRecords: expected %v but got %v", test.expectation.usageRecords, report.UsageRecords)
			}

			// Custom expectations
			customTestFunction := test.expectation.custom
			if customTestFunction != nil {
				(*customTestFunction)(t, report)
				require.NoError(t, err)
			}
		})
	}
}
