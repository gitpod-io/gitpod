// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

func TestCreditSummaryForTeams(t *testing.T) {
	ctx := context.Background()
	dbconn := dbtest.ConnectForTests(t)
	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)
	generator := NewReportGenerator(dbconn, DefaultWorkspacePricer)
	v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService(dbconn, generator, nil))
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	usageClient := v1.NewUsageServiceClient(conn)

	teamID_A, teamID_B := uuid.New().String(), uuid.New().String()
	teamAttributionID_A, teamAttributionID_B := db.NewTeamAttributionID(teamID_A), db.NewTeamAttributionID(teamID_B)

	costCenter := &db.CostCenter{
		ID:            db.NewTeamAttributionID(string(teamAttributionID_A)),
		SpendingLimit: 100,
	}

	require.NoError(t, dbconn.Create(costCenter).Error)

	scenarios := []struct {
		Name              string
		Sessions          []*v1.BilledSession
		BillSessionsAfter time.Time
		Expected          map[string]int64
	}{
		{
			Name:              "no instances in report, no summary",
			BillSessionsAfter: time.Time{},
			Sessions:          []*v1.BilledSession{},
			Expected:          map[string]int64{},
		},
		{
			Name:              "skips user attributions",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					AttributionId: string(db.NewUserAttributionID(uuid.New().String())),
				},
			},
			Expected: map[string]int64{},
		},
		{
			Name:              "two workspace instances",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					// has 1 day and 23 hours of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       (24 + 23) * 10,
				},
				{
					// has 1 hour of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       10,
				},
			},
			Expected: map[string]int64{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: 480,
			},
		},
		{
			Name:              "multiple teams",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					// has 12 hours of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       (12) * 10,
				},
				{
					// has 1 day of usage
					AttributionId: string(teamAttributionID_B),
					Credits:       (24) * 10,
				},
			},
			Expected: map[string]int64{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: 120,
				teamID_B: 240,
			},
		},
		{
			Name:              "two instances, same team, one of which started too early to be considered",
			BillSessionsAfter: time.Now().AddDate(0, 0, -2),
			Sessions: []*v1.BilledSession{
				{
					// has 12 hours of usage, started yesterday
					AttributionId: string(teamAttributionID_A),
					Credits:       (12) * 10,
					StartTime:     timestamppb.New(time.Now().AddDate(0, 0, -1)),
				},
				{
					// has 1 day of usage, but started three days ago
					AttributionId: string(teamAttributionID_A),
					Credits:       (24) * 10,
					StartTime:     timestamppb.New(time.Now().AddDate(0, 0, -3)),
				},
			},
			Expected: map[string]int64{
				teamID_A: 120,
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			svc := NewBillingService(&stripe.Client{}, s.BillSessionsAfter, &gorm.DB{}, usageClient)
			actual, err := svc.creditSummaryForTeams(ctx, s.Sessions)
			require.NoError(t, err)
			require.Equal(t, s.Expected, actual)
		})
	}

	t.Cleanup(func() {
		dbconn.Model(&db.CostCenter{}).Delete(costCenter)
	})
}

func TestCalculateAdjustedCreditsUsed(t *testing.T) {
	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)
	baseserver.StartServerForTests(t, srv)
	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	usageClient := v1.NewUsageServiceClient(conn)
	svc := NewBillingService(&stripe.Client{}, time.Time{}, &gorm.DB{}, usageClient)

	scenarios := []struct {
		Name            string
		UpcomingInvoice float64
		SpendingLimit   float64
		Expected        float64
	}{
		{
			Name:            "UpcomingInvoice > SpendingLimit",
			UpcomingInvoice: float64(500),
			SpendingLimit:   float64(400),
			Expected:        float64(500),
		},
		{
			Name:            "UpcomingInvoice < SpendingLimit",
			UpcomingInvoice: float64(400),
			SpendingLimit:   float64(500),
			Expected:        float64(500),
		},
		{
			Name:            "UpcomingInvoice == SpendingLimit",
			UpcomingInvoice: float64(500),
			SpendingLimit:   float64(500),
			Expected:        float64(500),
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			result := svc.calculateAdjustedCreditsUsed(s.UpcomingInvoice, s.SpendingLimit)
			require.NoError(t, err)
			require.Equal(t, result, s.Expected)
		})
	}
}
