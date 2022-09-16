// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

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

func NewBillingService(stripeClient *stripe.Client, conn *gorm.DB) *BillingService {
	return &BillingService{
		stripeClient: stripeClient,
		conn:         conn,
	}
}

type BillingService struct {
	conn         *gorm.DB
	stripeClient *stripe.Client

	v1.UnimplementedBillingServiceServer
}

func (s *BillingService) ReconcileInvoices(ctx context.Context, in *v1.ReconcileInvoicesRequest) (*v1.ReconcileInvoicesResponse, error) {
	balances, err := db.ListBalance(ctx, s.conn)
	if err != nil {
		log.WithError(err).Errorf("Failed to reconcile invoices.")
		return nil, status.Errorf(codes.Internal, "Failed to reconcile invoices.")
	}

	creditSummaryForTeams := map[db.AttributionID]int64{}
	for _, balance := range balances {
		creditSummaryForTeams[balance.AttributionID] = int64(math.Ceil(balance.CreditCents.ToCredits()))
	}

	err = s.stripeClient.UpdateUsage(ctx, creditSummaryForTeams)
	if err != nil {
		log.WithError(err).Errorf("Failed to udpate usage in stripe.")
		return nil, status.Errorf(codes.Internal, "Failed to update usage in stripe")
	}

	return &v1.ReconcileInvoicesResponse{}, nil
}

func (s *BillingService) FinalizeInvoice(ctx context.Context, in *v1.FinalizeInvoiceRequest) (*v1.FinalizeInvoiceResponse, error) {
	logger := log.WithField("invoice_id", in.GetInvoiceId())

	if in.GetInvoiceId() == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Missing InvoiceID")
	}

	invoice, err := s.stripeClient.GetInvoiceWithCustomer(ctx, in.GetInvoiceId())
	if err != nil {
		logger.WithError(err).Error("Failed to retrieve invoice from Stripe.")
		return nil, status.Errorf(codes.NotFound, "Failed to get invoice with ID %s: %s", in.GetInvoiceId(), err.Error())
	}

	customer := invoice.Customer
	if customer == nil {
		logger.Error("No customer information available for invoice.")
		return nil, status.Errorf(codes.Internal, "Failed to retrieve customer details from invoice.")
	}
	logger = logger.WithField("stripe_customer", customer.ID).WithField("stripe_customer_name", customer.Name)

	teamID, found := customer.Metadata[stripe.AttributionIDMetadataKey]
	if !found {
		logger.Error("Failed to find teamID from subscription metadata.")
		return nil, status.Errorf(codes.Internal, "Failed to extra teamID from Stripe subscription.")
	}
	logger = logger.WithField("team_id", teamID)

	// To support individual `user`s, we'll need to also extract the `userId` from metadata here and handle separately.
	attributionID := db.NewTeamAttributionID(teamID)
	finalizedAt := time.Unix(invoice.StatusTransitions.FinalizedAt, 0)

	logger = logger.
		WithField("attribution_id", attributionID).
		WithField("invoice_finalized_at", finalizedAt)

	if invoice.Lines == nil || len(invoice.Lines.Data) == 0 {
		logger.Errorf("Invoice %s did not contain any lines  so we cannot extract quantity to reflect it in usage.", invoice.ID)
		return nil, status.Errorf(codes.Internal, "Invoice did not contain any lines.")
	}

	lines := invoice.Lines.Data
	if len(lines) != 1 {
		logger.Error("Invoice did not contain exactly 1 line item, we cannot extract quantity to reflect in usage.")
		return nil, status.Errorf(codes.Internal, "Invoice did not contain exactly one line item.")
	}

	creditsOnInvoice := lines[0].Quantity

	usage := db.Usage{
		ID:            uuid.New(),
		AttributionID: attributionID,
		Description:   fmt.Sprintf("Invoice %s finalized in Stripe", invoice.ID),
		// Apply negative value of credits to reduce accrued credit usage
		CreditCents:   db.NewCreditCents(float64(-creditsOnInvoice)),
		EffectiveTime: db.NewVarcharTime(finalizedAt),
		Kind:          db.InvoiceUsageKind,
		Draft:         false,
		Metadata:      nil,
	}
	err = db.InsertUsage(ctx, s.conn, usage)
	if err != nil {
		logger.WithError(err).Errorf("Failed to insert Invoice usage record into the db.")
		return nil, status.Errorf(codes.Internal, "Failed to insert Invoice into usage records.")
	}

	logger.WithField("usage_id", usage.ID).Infof("Inserted usage record into database for %d credits against %s attribution", creditsOnInvoice, attributionID)

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
