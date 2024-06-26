// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

func TestUsageService_ReconcileUsage(t *testing.T) {
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
		StartedTime:        db.NewVarCharTime(from),
		StoppingTime:       db.NewVarCharTime(to.Add(-1 * time.Minute)),
	})
	dbtest.CreateWorkspaceInstances(t, dbconn, instance)

	// running instances
	dbtest.CreateWorkspaceInstances(t, dbconn, dbtest.NewWorkspaceInstance(t, db.WorkspaceInstance{
		StartedTime:        db.NewVarCharTime(to.Add(-1 * time.Minute)),
		UsageAttributionID: attributionID,
	}))

	// usage drafts
	dbtest.CreateUsageRecords(t, dbconn, dbtest.NewUsage(t, db.Usage{
		ID:                  uuid.New(),
		AttributionID:       attributionID,
		WorkspaceInstanceID: &instance.ID,
		Kind:                db.WorkspaceInstanceUsageKind,
		Draft:               true,
	}))

	client := newUsageService(t, dbconn)

	_, err := client.ReconcileUsage(context.Background(), &v1.ReconcileUsageRequest{
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

func newUsageService(t *testing.T, dbconn *gorm.DB) v1.UsageServiceClient {
	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)

	costCenterManager := db.NewCostCenterManager(dbconn, db.DefaultSpendingLimit{
		ForTeams:            0,
		ForUsers:            500,
		MinForUsersOnStripe: 1000,
	})

	usageService, err := NewUsageService(dbconn, DefaultWorkspacePricer, costCenterManager, "1m")
	if err != nil {
		t.Fatal(err)
	}
	v1.RegisterUsageServiceServer(srv.GRPC(), usageService)
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	client := v1.NewUsageServiceClient(conn)
	return client
}

func TestReconcile(t *testing.T) {
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
		inserts, updates, err := reconcileUsage(nil, nil, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 0)
		require.Len(t, updates, 0)
	})

	t.Run("no action with no instances but existing drafts", func(t *testing.T) {
		drafts := []db.Usage{dbtest.NewUsage(t, db.Usage{})}
		inserts, updates, err := reconcileUsage(nil, drafts, pricer, now)
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
			StartedTime:        db.NewVarCharTime(now.Add(1 * time.Minute)),
		}

		inserts, updates, err := reconcileUsage([]db.WorkspaceInstanceForUsage{instance, instance}, nil, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 1)
		require.Len(t, updates, 0)
		expectedUsage := db.Usage{
			ID:                  inserts[0].ID,
			AttributionID:       instance.UsageAttributionID,
			Description:         usageDescriptionFromController,
			CreditCents:         db.NewCreditCents(pricer.CreditsUsedByInstance(&instance, now)),
			EffectiveTime:       db.NewVarCharTime(now),
			Kind:                db.WorkspaceInstanceUsageKind,
			WorkspaceInstanceID: &instance.ID,
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
			StartedTime:        db.NewVarCharTime(now.Add(1 * time.Minute)),
		}

		// the fields in the usage record deliberately do not match the instance, except for the Instance ID.
		// we do this to test that the fields in the usage records get updated to reflect the true values from the source of truth - instances.
		draft := dbtest.NewUsage(t, db.Usage{
			ID:                  uuid.New(),
			AttributionID:       db.NewTeamAttributionID(uuid.New().String()),
			Description:         "Some description",
			CreditCents:         1,
			EffectiveTime:       db.VarcharTime{},
			Kind:                db.WorkspaceInstanceUsageKind,
			WorkspaceInstanceID: &instance.ID,
			Draft:               true,
			Metadata:            nil,
		})

		inserts, updates, err := reconcileUsage([]db.WorkspaceInstanceForUsage{instance}, []db.Usage{draft}, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 0)
		require.Len(t, updates, 1)

		expectedUsage := db.Usage{
			ID:                  draft.ID,
			AttributionID:       instance.UsageAttributionID,
			Description:         usageDescriptionFromController,
			CreditCents:         db.NewCreditCents(pricer.CreditsUsedByInstance(&instance, now)),
			EffectiveTime:       db.NewVarCharTime(now),
			Kind:                db.WorkspaceInstanceUsageKind,
			WorkspaceInstanceID: &instance.ID,
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

	t.Run("handles instances without stopping but stopped time", func(t *testing.T) {
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
			StartedTime:        db.NewVarCharTime(now.Add(1 * time.Minute)),
			StoppedTime:        db.NewVarCharTime(now.Add(2 * time.Minute)),
		}

		inserts, updates, err := reconcileUsage([]db.WorkspaceInstanceForUsage{instance}, []db.Usage{}, pricer, now)
		require.NoError(t, err)
		require.Len(t, inserts, 1)
		require.Len(t, updates, 0)

		require.EqualValues(t, db.NewCreditCents(0.17), inserts[0].CreditCents)
		require.EqualValues(t, instance.StoppedTime, inserts[0].EffectiveTime)
	})
}

func TestGetAndSetCostCenter(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	costCenterUpdates := []*v1.CostCenter{
		{
			AttributionId:   string(db.NewTeamAttributionID(uuid.New().String())),
			SpendingLimit:   8000,
			BillingStrategy: v1.CostCenter_BILLING_STRATEGY_STRIPE,
		},
		{
			AttributionId:   string(db.NewTeamAttributionID(uuid.New().String())),
			SpendingLimit:   500,
			BillingStrategy: v1.CostCenter_BILLING_STRATEGY_OTHER,
		},
		{
			AttributionId:   string(db.NewTeamAttributionID(uuid.New().String())),
			SpendingLimit:   8000,
			BillingStrategy: v1.CostCenter_BILLING_STRATEGY_STRIPE,
		},
		{
			AttributionId:   string(db.NewTeamAttributionID(uuid.New().String())),
			SpendingLimit:   0,
			BillingStrategy: v1.CostCenter_BILLING_STRATEGY_OTHER,
		},
	}

	service := newUsageService(t, conn)

	for _, costCenter := range costCenterUpdates {
		retrieved, err := service.SetCostCenter(context.Background(), &v1.SetCostCenterRequest{
			CostCenter: costCenter,
		})
		require.NoError(t, err)

		require.Equal(t, costCenter.SpendingLimit, retrieved.CostCenter.SpendingLimit)
		require.Equal(t, costCenter.BillingStrategy, retrieved.CostCenter.BillingStrategy)
	}
}

func TestListUsage(t *testing.T) {

	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC)

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	draftBefore := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(-1 * 23 * time.Hour)),
		CreditCents:   100,
		Draft:         true,
	})

	nondraftBefore := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(-1 * 23 * time.Hour)),
		CreditCents:   200,
		Draft:         false,
	})

	draftInside := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		CreditCents:   300,
		Draft:         true,
	})
	nonDraftInside := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		CreditCents:   400,
		Draft:         false,
	})

	nonDraftAfter := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(end.Add(2 * time.Hour)),
		CreditCents:   1000,
	})

	tests := []struct {
		start, end time.Time
		// expectations
		creditsUsed    float64
		recordsInRange int64
	}{
		{start, end, 7, 2},
		{end, end, 0, 0},
		{start, start, 0, 0},
		{start.Add(-200 * 24 * time.Hour), end, 10, 4},
		{start.Add(-200 * 24 * time.Hour), end.Add(10 * 24 * time.Hour), 20, 5},
	}

	for i, test := range tests {
		t.Run(fmt.Sprintf("test no %d", i+1), func(t *testing.T) {
			conn := dbtest.ConnectForTests(t)
			dbtest.CreateUsageRecords(t, conn, draftBefore, nondraftBefore, draftInside, nonDraftInside, nonDraftAfter)

			usageService := newUsageService(t, conn)

			metaData, err := usageService.ListUsage(context.Background(), &v1.ListUsageRequest{
				AttributionId: string(attributionID),
				From:          timestamppb.New(test.start),
				To:            timestamppb.New(test.end),
				Order:         v1.ListUsageRequest_ORDERING_DESCENDING,
				Pagination: &v1.PaginatedRequest{
					PerPage: 1,
					Page:    1,
				},
			})
			require.NoError(t, err)

			require.Equal(t, test.creditsUsed, metaData.CreditsUsed)
			require.Equal(t, test.recordsInRange, metaData.Pagination.Total)
		})
	}

}

func TestAddUSageCreditNote(t *testing.T) {
	tests := []struct {
		credits     int32
		userId      string
		description string
		// expectations
		expectedError bool
	}{
		{300, uuid.New().String(), "Something", false},
		{300, "bad-userid", "Something", true},
		{300, uuid.New().String(), "    " /* no note */, true},
		{-300, uuid.New().String(), "Negative Balance", false},
	}

	for i, test := range tests {
		t.Run(fmt.Sprintf("test no %d", i+1), func(t *testing.T) {
			attributionID := db.NewTeamAttributionID(uuid.New().String())
			conn := dbtest.ConnectForTests(t)
			usageService := newUsageService(t, conn)

			_, err := usageService.AddUsageCreditNote(context.Background(), &v1.AddUsageCreditNoteRequest{
				AttributionId: string(attributionID),
				Credits:       test.credits,
				Description:   test.description,
				UserId:        test.userId,
			})
			if test.expectedError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				balance, err := db.GetBalance(context.Background(), conn, attributionID)
				require.NoError(t, err)
				require.Equal(t, int32(balance.ToCredits()), test.credits*-1)
			}
			require.NoError(t, conn.Where("attributionId = ?", attributionID).Delete(&db.Usage{}).Error)
		})
	}

}
