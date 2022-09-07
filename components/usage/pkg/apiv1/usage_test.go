// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"database/sql"
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

func TestUsageService_ListUsage(t *testing.T) {
	ctx := context.Background()

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	type Expectation struct {
		Code                 codes.Code
		InstanceIds          []string
		CreditBalanceAtStart float64
		CreditBalanceAtEnd   float64
	}

	type Scenario struct {
		name      string
		Instances []db.Usage
		Request   *v1.ListUsageRequest
		Expect    Expectation
	}

	scenarios := []Scenario{
		{
			name:      "fails when From is after To",
			Instances: nil,
			Request: &v1.ListUsageRequest{
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
			name:      "fails when time range is greater than 300 days",
			Instances: nil,
			Request: &v1.ListUsageRequest{
				AttributionId: string(attributionID),
				From:          timestamppb.New(time.Date(2021, 7, 1, 13, 0, 0, 0, time.UTC)),
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
			var instances []db.Usage
			for i := 0; i < 4; i++ {
				instance := dbtest.NewUsage(t, db.Usage{
					AttributionID: attrID,
					EffectiveTime: db.NewVarcharTime(start.Add(time.Duration(i) * 24 * time.Hour)),
					CreditCents:   20,
				})
				instances = append(instances, instance)
			}

			return Scenario{
				name:      "filters results to specified time range, ascending",
				Instances: instances,
				Request: &v1.ListUsageRequest{
					AttributionId: string(attrID),
					From:          timestamppb.New(start),
					To:            timestamppb.New(start.Add(3 * 24 * time.Hour)),
					Order:         v1.ListUsageRequest_ORDERING_ASCENDING,
				},
				Expect: Expectation{
					Code:                 codes.OK,
					InstanceIds:          []string{instances[0].ID.String(), instances[1].ID.String(), instances[2].ID.String()},
					CreditBalanceAtStart: 0,
					CreditBalanceAtEnd:   0.6,
				},
			}
		})(),
		(func() Scenario {
			start := time.Date(2022, 07, 1, 13, 0, 0, 0, time.UTC)
			attrID := db.NewTeamAttributionID(uuid.New().String())
			var instances []db.Usage
			for i := 0; i < 3; i++ {
				instance := dbtest.NewUsage(t, db.Usage{
					AttributionID: attrID,
					EffectiveTime: db.NewVarcharTime(start.Add(time.Duration(i) * 24 * time.Hour)),
					CreditCents:   60,
				})
				instances = append(instances, instance)
			}

			return Scenario{
				name:      "filters results to specified time range, descending",
				Instances: instances,
				Request: &v1.ListUsageRequest{
					AttributionId: string(attrID),
					From:          timestamppb.New(start),
					To:            timestamppb.New(start.Add(5 * 24 * time.Hour)),
					Order:         v1.ListUsageRequest_ORDERING_DESCENDING,
				},
				Expect: Expectation{
					Code:                 codes.OK,
					InstanceIds:          []string{instances[2].ID.String(), instances[1].ID.String(), instances[0].ID.String()},
					CreditBalanceAtStart: 0,
					CreditBalanceAtEnd:   1.8,
				},
			}
		})(),
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			dbconn := dbtest.ConnectForTests(t)
			dbtest.CreateUsageRecords(t, dbconn, scenario.Instances...)

			srv := baseserver.NewForTests(t,
				baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
			)

			generator := NewReportGenerator(dbconn, DefaultWorkspacePricer)
			v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService(dbconn, generator, nil, DefaultWorkspacePricer))
			baseserver.StartServerForTests(t, srv)

			conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
			require.NoError(t, err)

			client := v1.NewUsageServiceClient(conn)

			resp, err := client.ListUsage(ctx, scenario.Request)
			require.Equal(t, scenario.Expect.Code, status.Code(err), err)

			if err != nil {
				return
			}

			var instanceIds []string
			for _, usageEntry := range resp.UsageEntries {
				instanceIds = append(instanceIds, usageEntry.Id)
			}

			require.Equal(t, scenario.Expect.InstanceIds, instanceIds)

			require.Equal(t, scenario.Expect.CreditBalanceAtStart, resp.CreditBalanceAtStart, "creditBalanceAtStart")
			require.Equal(t, scenario.Expect.CreditBalanceAtEnd, resp.CreditBalanceAtEnd, "creditBalanceAtEnd")
		})
	}
}

func TestInstanceToUsageRecords(t *testing.T) {
	maxStopTime := time.Date(2022, 05, 31, 23, 00, 00, 00, time.UTC)
	teamID, ownerID, projectID := uuid.New().String(), uuid.New(), uuid.New()
	workspaceID := dbtest.GenerateWorkspaceID()
	teamAttributionID := db.NewTeamAttributionID(teamID)
	instanceId := uuid.New()
	startedTime := db.NewVarcharTime(time.Date(2022, 05, 30, 00, 01, 00, 00, time.UTC))
	stoppingTime := db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC))

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
					StartedTime:        startedTime,
					StoppingTime:       stoppingTime,
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
				CreditsUsed:    469.8333333333333,
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
					StartedTime:        startedTime,
					StoppingTime:       db.VarcharTime{},
				},
			},
			Expected: []db.WorkspaceInstanceUsage{{
				InstanceID:     instanceId,
				AttributionID:  teamAttributionID,
				UserID:         ownerID,
				ProjectID:      projectID.String(),
				WorkspaceID:    workspaceID,
				WorkspaceType:  db.WorkspaceType_Regular,
				StartedAt:      startedTime.Time(),
				StoppedAt:      sql.NullTime{},
				WorkspaceClass: defaultWorkspaceClass,
				CreditsUsed:    469.8333333333333,
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

func TestUsageService_ReconcileUsageWithLedger(t *testing.T) {
	dbconn := dbtest.ConnectForTests(t)
	from := time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)
	to := time.Date(2022, 05, 1, 1, 00, 00, 00, time.UTC)
	attributionID := db.NewTeamAttributionID(uuid.New().String())

	t.Cleanup(func() {
		require.NoError(t, dbconn.Where("attributionId = ?", attributionID).Delete(&db.Usage{}).Error)
	})

	// stopped instances
	instance := dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
		UsageAttributionID: attributionID,
		StartedTime:        db.NewVarcharTime(from),
		StoppingTime:       db.NewVarcharTime(to.Add(-1 * time.Minute)),
	})
	dbtest.CreateWorkspaceInstances(t, dbconn, instance)

	// running instances
	dbtest.CreateWorkspaceInstances(t, dbconn, dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
		StartedTime:        db.NewVarcharTime(to.Add(-1 * time.Minute)),
		UsageAttributionID: attributionID,
	}))

	// usage drafts
	dbtest.CreateUsageRecords(t, dbconn, dbtest.NewUsage(t, db.Usage{
		ID:                  uuid.New(),
		AttributionID:       attributionID,
		WorkspaceInstanceID: instance.ID,
		Kind:                db.WorkspaceInstanceUsageKind,
		Draft:               true,
	}))

	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)

	v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService(dbconn, nil, nil, DefaultWorkspacePricer))
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	client := v1.NewUsageServiceClient(conn)

	_, err = client.ReconcileUsageWithLedger(context.Background(), &v1.ReconcileUsageWithLedgerRequest{
		From: timestamppb.New(from),
		To:   timestamppb.New(to),
	})
	require.NoError(t, err)

	usage, err := db.FindUsage(context.Background(), dbconn, &db.FindUsageParams{
		AttributionId: attributionID,
		From:          from,
		To:            to,
		ExcludeDrafts: false,
	})
	require.NoError(t, err)
	require.Len(t, usage, 1)
}

func TestReconcileWithLedger(t *testing.T) {
	now := time.Date(2022, 9, 1, 10, 0, 0, 0, time.UTC)
	pricer, err := NewWorkspacePricer(map[string]float64{
		"default":              0.1666666667,
		"g1-standard":          0.1666666667,
		"g1-standard-pvc":      0.1666666667,
		"g1-large":             0.3333333333,
		"g1-large-pvc":         0.3333333333,
		"gitpodio-internal-xl": 0.3333333333,
	})
	require.NoError(t, err)

	t.Run("no action with no instances and no drafts", func(t *testing.T) {
		inserts, updates, err := reconcileUsageWithLedger(nil, nil, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 0)
		require.Len(t, updates, 0)
	})

	t.Run("no action with no instances but existing drafts", func(t *testing.T) {
		drafts := []db.Usage{dbtest.NewUsage(t, db.Usage{})}
		inserts, updates, err := reconcileUsageWithLedger(nil, drafts, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 0)
		require.Len(t, updates, 0)
	})

	t.Run("creates a new usage record when no draft exists, removing duplicates", func(t *testing.T) {
		instance := db.WorkspaceInstanceForUsage{
			ID:          uuid.New(),
			WorkspaceID: dbtest.GenerateWorkspaceID(),
			OwnerID:     uuid.New(),
			ProjectID: sql.NullString{
				String: "my-project",
				Valid:  true,
			},
			WorkspaceClass:     db.WorkspaceClass_Default,
			Type:               db.WorkspaceType_Regular,
			UsageAttributionID: db.NewTeamAttributionID(uuid.New().String()),
			StartedTime:        db.NewVarcharTime(now.Add(1 * time.Minute)),
		}

		inserts, updates, err := reconcileUsageWithLedger([]db.WorkspaceInstanceForUsage{instance, instance}, nil, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 1)
		require.Len(t, updates, 0)
		expectedUsage := db.Usage{
			ID:                  inserts[0].ID,
			AttributionID:       instance.UsageAttributionID,
			Description:         usageDescriptionFromController,
			CreditCents:         db.NewCreditCents(pricer.CreditsUsedByInstance(&instance, now)),
			EffectiveTime:       db.NewVarcharTime(now),
			Kind:                db.WorkspaceInstanceUsageKind,
			WorkspaceInstanceID: instance.ID,
			Draft:               true,
			Metadata:            nil,
		}
		require.NoError(t, expectedUsage.SetMetadataWithWorkspaceInstance(db.WorkspaceInstanceUsageData{
			WorkspaceId:    instance.WorkspaceID,
			WorkspaceType:  instance.Type,
			WorkspaceClass: instance.WorkspaceClass,
			ContextURL:     instance.ContextURL,
			StartTime:      db.TimeToISO8601(instance.StartedTime.Time()),
			EndTime:        "",
			UserName:       instance.UserName,
			UserAvatarURL:  instance.UserAvatarURL,
		}))
		require.EqualValues(t, expectedUsage, inserts[0])
	})

	t.Run("updates a usage record when a draft exists", func(t *testing.T) {
		instance := db.WorkspaceInstanceForUsage{
			ID:          uuid.New(),
			WorkspaceID: dbtest.GenerateWorkspaceID(),
			OwnerID:     uuid.New(),
			ProjectID: sql.NullString{
				String: "my-project",
				Valid:  true,
			},
			WorkspaceClass:     db.WorkspaceClass_Default,
			Type:               db.WorkspaceType_Regular,
			UsageAttributionID: db.NewTeamAttributionID(uuid.New().String()),
			StartedTime:        db.NewVarcharTime(now.Add(1 * time.Minute)),
		}

		// the fields in the usage record deliberately do not match the instance, except for the Instance ID.
		// we do this to test that the fields in the usage records get updated to reflect the true values from the source of truth - instances.
		draft := dbtest.NewUsage(t, db.Usage{
			ID:                  uuid.New(),
			AttributionID:       db.NewUserAttributionID(uuid.New().String()),
			Description:         "Some description",
			CreditCents:         1,
			EffectiveTime:       db.VarcharTime{},
			Kind:                db.WorkspaceInstanceUsageKind,
			WorkspaceInstanceID: instance.ID,
			Draft:               true,
			Metadata:            nil,
		})

		inserts, updates, err := reconcileUsageWithLedger([]db.WorkspaceInstanceForUsage{instance}, []db.Usage{draft}, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 0)
		require.Len(t, updates, 1)

		expectedUsage := db.Usage{
			ID:                  draft.ID,
			AttributionID:       instance.UsageAttributionID,
			Description:         usageDescriptionFromController,
			CreditCents:         db.NewCreditCents(pricer.CreditsUsedByInstance(&instance, now)),
			EffectiveTime:       db.NewVarcharTime(now),
			Kind:                db.WorkspaceInstanceUsageKind,
			WorkspaceInstanceID: instance.ID,
			Draft:               true,
			Metadata:            nil,
		}
		require.NoError(t, expectedUsage.SetMetadataWithWorkspaceInstance(db.WorkspaceInstanceUsageData{
			WorkspaceId:    instance.WorkspaceID,
			WorkspaceType:  instance.Type,
			WorkspaceClass: instance.WorkspaceClass,
			ContextURL:     instance.ContextURL,
			StartTime:      db.TimeToISO8601(instance.StartedTime.Time()),
			EndTime:        "",
			UserName:       instance.UserName,
			UserAvatarURL:  instance.UserAvatarURL,
		}))
		require.EqualValues(t, expectedUsage, updates[0])
	})
}
