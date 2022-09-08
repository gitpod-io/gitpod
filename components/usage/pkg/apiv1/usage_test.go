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
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/timestamppb"
)

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

	v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService(dbconn, DefaultWorkspacePricer))
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
