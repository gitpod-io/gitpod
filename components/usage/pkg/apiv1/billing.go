// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"github.com/gitpod-io/gitpod/usage/pkg/contentservice"
	"math"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/google/uuid"
	stripesdk "github.com/stripe/stripe-go/v72"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

func NewBillingService(stripeClient *stripe.Client, billInstancesAfter time.Time, conn *gorm.DB) *BillingService {
	return &BillingService{
		stripeClient:       stripeClient,
		billInstancesAfter: billInstancesAfter,
		conn:               conn,
	}
}

type BillingService struct {
	conn               *gorm.DB
	stripeClient       *stripe.Client
	billInstancesAfter time.Time

	contentService contentservice.Interface

	v1.UnimplementedBillingServiceServer
}

func (s *BillingService) UpdateInvoices(ctx context.Context, in *v1.UpdateInvoicesRequest) (*v1.UpdateInvoicesResponse, error) {
	if in.GetReportId() == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Missing report ID")
	}

	report, err := s.contentService.DownloadUsageReport(ctx, in.GetReportId())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to download usage report with ID: %s", in.GetReportId())
	}

	credits, err := s.creditSummaryForTeams(report)
	if err != nil {
		log.Log.WithError(err).Errorf("Failed to compute credit summary.")
		return nil, status.Errorf(codes.InvalidArgument, "failed to compute credit summary")
	}

	err = s.stripeClient.UpdateUsage(ctx, credits)
	if err != nil {
		log.Log.WithError(err).Errorf("Failed to update stripe invoices.")
		return nil, status.Errorf(codes.Internal, "failed to update stripe invoices")
	}

	return &v1.UpdateInvoicesResponse{}, nil
}

func (s *BillingService) FinalizeInvoice(ctx context.Context, in *v1.FinalizeInvoiceRequest) (*v1.FinalizeInvoiceResponse, error) {
	log.Infof("Finalizing invoice for invoice %q", in.GetInvoiceId())

	return &v1.FinalizeInvoiceResponse{}, nil
}

func (s *BillingService) GetUpcomingInvoice(ctx context.Context, in *v1.GetUpcomingInvoiceRequest) (*v1.GetUpcomingInvoiceResponse, error) {
	if in.GetTeamId() == "" && in.GetUserId() == "" {
		return nil, status.Errorf(codes.InvalidArgument, "teamId or userId is required")
	}

	var customer *stripesdk.Customer
	var err error
	if teamID := in.GetTeamId(); teamID != "" {
		customer, err = s.stripeClient.GetCustomerByTeamID(ctx, teamID)
	} else {
		customer, err = s.stripeClient.GetCustomerByUserID(ctx, in.GetUserId())
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to find customer")
	}

	invoice, err := s.stripeClient.GetUpcomingInvoice(ctx, customer.ID)
	if err != nil {
		log.Log.WithError(err).Errorf("Failed to fetch upcoming invoice from stripe.")
		return nil, status.Errorf(codes.Internal, "failed to fetcht upcoming invoice from stripe")
	}

	return &v1.GetUpcomingInvoiceResponse{
		InvoiceId: invoice.ID,
		Currency:  invoice.Currency,
		Amount:    float64(invoice.Amount),
		Credits:   invoice.Credits,
	}, nil
}

func (s *BillingService) creditSummaryForTeams(sessions db.UsageReport) (map[string]int64, error) {
	creditsPerTeamID := map[string]float64{}

	for _, session := range sessions {
		if session.StartedAt.Before(s.billInstancesAfter) {
			continue
		}

		entity, id := session.AttributionID.Values()
		if entity != db.AttributionEntity_Team {
			continue
		}

		if _, ok := creditsPerTeamID[id]; !ok {
			creditsPerTeamID[id] = 0
		}

		creditsPerTeamID[id] += session.CreditsUsed
	}

	rounded := map[string]int64{}
	for teamID, credits := range creditsPerTeamID {
		rounded[teamID] = int64(math.Ceil(credits))
	}

	return rounded, nil
}

func (s *BillingService) SetBilledSession(ctx context.Context, in *v1.SetBilledSessionRequest) (*v1.SetBilledSessionResponse, error) {
	var from time.Time
	if in.From != nil {
		from = in.From.AsTime()
	}
	uuid, err := uuid.Parse(in.InstanceId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to parse instance ID: %s", err)
	}
	err = db.SetBilled(ctx, s.conn, uuid, from, in.System)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to set session: %s", err)
	}

	return &v1.SetBilledSessionResponse{}, nil
}
