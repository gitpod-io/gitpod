// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

func NewBillingService(stripeClient *stripe.Client, conn *gorm.DB, ccManager *db.CostCenterManager) *BillingService {
	return &BillingService{
		stripeClient: stripeClient,
		conn:         conn,
		ccManager:    ccManager,
	}
}

type BillingService struct {
	conn         *gorm.DB
	stripeClient *stripe.Client
	ccManager    *db.CostCenterManager

	v1.UnimplementedBillingServiceServer
}

func (s *BillingService) GetStripeCustomer(ctx context.Context, req *v1.GetStripeCustomerRequest) (*v1.GetStripeCustomerResponse, error) {
	switch identifier := req.GetIdentifier().(type) {
	case *v1.GetStripeCustomerRequest_AttributionId:
		attributionID, err := db.ParseAttributionID(identifier.AttributionId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "Invalid attribution ID %s", attributionID)
		}

		customer, err := s.stripeClient.GetCustomerByAttributionID(ctx, string(attributionID))
		if err != nil {
			return nil, err
		}

		return &v1.GetStripeCustomerResponse{
			AttributionId: string(attributionID),
			Customer: &v1.StripeCustomer{
				Id: customer.ID,
			},
		}, nil
	case *v1.GetStripeCustomerRequest_StripeCustomerId:
		customer, err := s.stripeClient.GetCustomer(ctx, identifier.StripeCustomerId)
		if err != nil {
			return nil, err
		}

		attributionID, err := stripe.GetAttributionID(ctx, customer)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "Failed to parse attribution ID from Stripe customer %s", customer.ID)
		}

		return &v1.GetStripeCustomerResponse{
			AttributionId: string(attributionID),
			Customer: &v1.StripeCustomer{
				Id: customer.ID,
			},
		}, nil
	default:
		return nil, status.Errorf(codes.InvalidArgument, "Unknown identifier")
	}
}

func (s *BillingService) ReconcileInvoices(ctx context.Context, in *v1.ReconcileInvoicesRequest) (*v1.ReconcileInvoicesResponse, error) {
	balances, err := db.ListBalance(ctx, s.conn)
	if err != nil {
		log.WithError(err).Errorf("Failed to reconcile invoices.")
		return nil, status.Errorf(codes.Internal, "Failed to reconcile invoices.")
	}

	stripeBalances, err := balancesForStripeCostCenters(ctx, s.ccManager, balances)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to identify stripe balances.")
	}

	creditCentsByAttribution := map[db.AttributionID]int64{}
	for _, balance := range stripeBalances {
		creditCentsByAttribution[balance.AttributionID] = int64(math.Ceil(balance.CreditCents.ToCredits()))
	}

	err = s.stripeClient.UpdateUsage(ctx, creditCentsByAttribution)
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

	attributionID, err := stripe.GetAttributionID(ctx, invoice.Customer)
	if err != nil {
		return nil, err
	}
	logger = logger.WithField("attributionID", attributionID)
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

func (s *BillingService) CancelSubscription(ctx context.Context, in *v1.CancelSubscriptionRequest) (*v1.CancelSubscriptionResponse, error) {
	logger := log.WithField("subscription_id", in.GetSubscriptionId())
	logger.Infof("Subscription ended. Setting cost center back to free.")
	if in.GetSubscriptionId() == "" {
		return nil, status.Errorf(codes.InvalidArgument, "subscriptionId is required")
	}

	subscription, err := s.stripeClient.GetSubscriptionWithCustomer(ctx, in.GetSubscriptionId())
	if err != nil {
		return nil, err
	}

	attributionID, err := stripe.GetAttributionID(ctx, subscription.Customer)
	if err != nil {
		return nil, err
	}

	costCenter, err := s.ccManager.GetOrCreateCostCenter(ctx, attributionID)
	if err != nil {
		return nil, err
	}

	costCenter.BillingStrategy = db.CostCenter_Other
	_, err = s.ccManager.UpdateCostCenter(ctx, costCenter)
	if err != nil {
		return nil, err
	}
	return &v1.CancelSubscriptionResponse{}, nil
}

func balancesForStripeCostCenters(ctx context.Context, cm *db.CostCenterManager, balances []db.Balance) ([]db.Balance, error) {
	var result []db.Balance
	for _, balance := range balances {
		// filter out balances for non-stripe attribution IDs
		costCenter, err := cm.GetOrCreateCostCenter(ctx, balance.AttributionID)
		if err != nil {
			return nil, err
		}

		// We only update Stripe usage when the AttributionID is billed against Stripe (determined through CostCenter)
		if costCenter.BillingStrategy != db.CostCenter_Stripe {
			continue
		}

		result = append(result, balance)
	}

	return result, nil
}
