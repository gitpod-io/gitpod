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
	stripesdk "github.com/stripe/stripe-go/v72"
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

	usageSvc := NewUsageService(dbconn, generator, nil)
	billingSvc := NewBillingService(nil, time.Time{}, dbconn, usageClient, billingClient)
	v1.RegisterUsageServiceServer(srv.GRPC(), usageSvc)
	v1.RegisterBillingServiceServer(srv.GRPC(), billingSvc)
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	usageClient := v1.NewUsageServiceClient(conn)
	billingClient := v1.NewBillingServiceClient(conn)

	teamID_A, teamID_B := uuid.New().String(), uuid.New().String()
	teamAttributionID_A, teamAttributionID_B := db.NewTeamAttributionID(teamID_A), db.NewTeamAttributionID(teamID_B)

	costCenter := &db.CostCenter{
		ID:            teamAttributionID_A,
		SpendingLimit: 100,
	}

	costCenter2 := &db.CostCenter{
		ID:            teamAttributionID_B,
		SpendingLimit: 300,
	}

	require.NoError(t, dbconn.Create(costCenter).Error)
	require.NoError(t, dbconn.Create(costCenter2).Error)
	read := &db.CostCenter{ID: costCenter.ID}
	tx := dbconn.First(read)
	require.NoError(t, tx.Error)

	// "creditsUsed" is the only relevant value at the moment for the test scenarios below
	// "spendingLimit" and "upcomingInvoice" will be relevant for the usage-capping
	scenarios := []struct {
		Name              string
		Sessions          []*v1.BilledSession
		BillSessionsAfter time.Time
		Expected          map[string]stripe.CreditSummary
	}{
		{
			Name:              "no instances in report, no summary",
			BillSessionsAfter: time.Time{},
			Sessions:          []*v1.BilledSession{},
			Expected:          map[string]stripe.CreditSummary{},
		},
		{
			Name:              "skips user attributions",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					AttributionId: string(db.NewUserAttributionID(uuid.New().String())),
				},
			},
			Expected: map[string]stripe.CreditSummary{},
		},
		{
			Name:              "two workspace instances",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					// has 1 day and 23 hours of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       (24 + 23) * 10,
					TeamId:        string(teamAttributionID_A),
				},
				{
					// has 1 hour of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       10,
					TeamId:        string(teamAttributionID_A),
				},
			},
			Expected: map[string]stripe.CreditSummary{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: {
					CreditsUsed:              480,
					SpendingLimitInCredits:   float64(read.SpendingLimit),
					UpcomingInvoiceInCredits: 500,
				},
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
					TeamId:        string(teamAttributionID_A),
				},
				{
					// has 1 day of usage
					AttributionId: string(teamAttributionID_B),
					Credits:       (24) * 10,
					TeamId:        string(teamAttributionID_B),
				},
			},
			Expected: map[string]stripe.CreditSummary{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: {
					CreditsUsed:              120,
					SpendingLimitInCredits:   float64(read.SpendingLimit),
					UpcomingInvoiceInCredits: 120,
				},
				teamID_B: {
					CreditsUsed:              240,
					SpendingLimitInCredits:   float64(read.SpendingLimit),
					UpcomingInvoiceInCredits: 240,
				},
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
					TeamId:        string(teamAttributionID_A),
				},
				{
					// has 1 day of usage, but started three days ago
					AttributionId: string(teamAttributionID_A),
					Credits:       (24) * 10,
					StartTime:     timestamppb.New(time.Now().AddDate(0, 0, -3)),
					TeamId:        string(teamAttributionID_A),
				},
			},
			Expected: map[string]stripe.CreditSummary{
				teamID_A: {
					CreditsUsed:              120,
					SpendingLimitInCredits:   float64(read.SpendingLimit),
					UpcomingInvoiceInCredits: 130,
				},
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			svc :=
			actual, err := svc.creditSummaryForTeams(ctx, s.Sessions)
			require.NoError(t, err)
			require.Equal(t, s.Expected["creditsUsed"], actual["creditsUsed"])
		})
	}
	t.Cleanup(func() {
		dbconn.Model(&db.CostCenter{}).Delete(costCenter, costCenter2)
	})
}

type testStripeClient struct{}

func (c *testStripeClient) GetUpcomingInvoice(ctx context.Context, id string) (*stripe.Invoice, error) {
	return &stripe.Invoice{
		ID:             "invoice.ID",
		SubscriptionID: "invoice.Subscription.ID",
		Amount:         100,
		Currency:       "currency",
		Credits:        350,
	}, nil
}

func (c *testStripeClient) UpdateUsage(ctx context.Context, creditsPerTeam map[string]map[string]float64) error {
	return nil
}

func (c *testStripeClient) GetCustomerByTeamID(ctx context.Context, teamID string) (*stripesdk.Customer, error) {
	return &stripesdk.Customer{}, nil
}

func (c *testStripeClient) GetCustomerByUserID(ctx context.Context, userID string) (*stripesdk.Customer, error) {
	return &stripesdk.Customer{}, nil
}
