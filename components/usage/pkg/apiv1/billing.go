// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"

	"math"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/google/uuid"
	stripe_api "github.com/stripe/stripe-go/v72"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

func NewBillingService(stripeClient *stripe.Client, conn *gorm.DB, ccManager *db.CostCenterManager, stripePrices stripe.StripePrices) *BillingService {
	return &BillingService{
		stripeClient: stripeClient,
		conn:         conn,
		ccManager:    ccManager,
		stripePrices: stripePrices,
	}
}

type BillingService struct {
	conn         *gorm.DB
	stripeClient *stripe.Client
	ccManager    *db.CostCenterManager
	stripePrices stripe.StripePrices

	v1.UnimplementedBillingServiceServer
}

func (s *BillingService) GetStripeCustomer(ctx context.Context, req *v1.GetStripeCustomerRequest) (*v1.GetStripeCustomerResponse, error) {

	storeStripeCustomerAndRespond := func(ctx context.Context, cus *stripe_api.Customer, attributionID db.AttributionID) (*v1.GetStripeCustomerResponse, error) {
		logger := log.WithField("stripe_customer_id", cus.ID).WithField("attribution_id", attributionID)
		// Store it in the DB such that subsequent lookups don't need to go to Stripe
		result, err := s.storeStripeCustomer(ctx, cus, attributionID)
		if err != nil {
			logger.WithError(err).Error("Failed to store stripe customer in the database.")

			// Storing failed, but we don't want to block the caller since we do have the data, return it as a success
			return &v1.GetStripeCustomerResponse{
				Customer: convertStripeCustomer(cus),
			}, nil
		}

		return &v1.GetStripeCustomerResponse{
			Customer: result,
		}, nil
	}

	switch identifier := req.GetIdentifier().(type) {
	case *v1.GetStripeCustomerRequest_AttributionId:
		attributionID, err := db.ParseAttributionID(identifier.AttributionId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "Invalid attribution ID %s", attributionID)
		}

		logger := log.WithField("attribution_id", attributionID)

		customer, err := db.GetStripeCustomerByAttributionID(ctx, s.conn, attributionID)
		if err != nil {
			// We don't yet have it in the DB
			if errors.Is(err, db.ErrorNotFound) {
				stripeCustomer, err := s.stripeClient.GetCustomerByAttributionID(ctx, string(attributionID))
				if err != nil {
					return nil, err
				}

				return storeStripeCustomerAndRespond(ctx, stripeCustomer, attributionID)
			}

			logger.WithError(err).Error("Failed to lookup stripe customer from DB")
		}

		return &v1.GetStripeCustomerResponse{
			Customer: convertDBStripeCustomerToResponse(customer),
		}, nil

	case *v1.GetStripeCustomerRequest_StripeCustomerId:
		if identifier.StripeCustomerId == "" {
			return nil, status.Errorf(codes.InvalidArgument, "empty stripe customer ID supplied")
		}

		logger := log.WithField("stripe_customer_id", identifier.StripeCustomerId)

		customer, err := db.GetStripeCustomer(ctx, s.conn, identifier.StripeCustomerId)
		if err != nil {
			// We don't yet have it in the DB
			if errors.Is(err, db.ErrorNotFound) {
				stripeCustomer, err := s.stripeClient.GetCustomer(ctx, identifier.StripeCustomerId)
				if err != nil {
					return nil, err
				}

				attributionID, err := stripe.GetAttributionID(ctx, stripeCustomer)
				if err != nil {
					return nil, status.Errorf(codes.Internal, "Failed to parse attribution ID from Stripe customer %s", stripeCustomer.ID)
				}

				return storeStripeCustomerAndRespond(ctx, stripeCustomer, attributionID)
			}

			logger.WithError(err).Error("Failed to lookup stripe customer from DB")

			return nil, status.Errorf(codes.NotFound, "Failed to lookup stripe customer from DB: %s", err.Error())
		}

		return &v1.GetStripeCustomerResponse{
			Customer: convertDBStripeCustomerToResponse(customer),
		}, nil

	default:
		return nil, status.Errorf(codes.InvalidArgument, "Unknown identifier")
	}
}

func (s *BillingService) CreateStripeCustomer(ctx context.Context, req *v1.CreateStripeCustomerRequest) (*v1.CreateStripeCustomerResponse, error) {
	attributionID, err := db.ParseAttributionID(req.GetAttributionId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Invalid attribution ID %s", attributionID)
	}
	if req.GetCurrency() == "" {
		return nil, status.Error(codes.InvalidArgument, "Invalid currency specified")
	}
	if req.GetEmail() == "" {
		return nil, status.Error(codes.InvalidArgument, "Invalid email specified")
	}
	if req.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "Invalid name specified")
	}

	customer, err := s.stripeClient.CreateCustomer(ctx, stripe.CreateCustomerParams{
		AttributuonID: string(attributionID),
		Currency:      req.GetCurrency(),
		Email:         req.GetEmail(),
		Name:          req.GetName(),
	})
	if err != nil {
		log.WithError(err).Errorf("Failed to create stripe customer.")
		return nil, status.Errorf(codes.Internal, "Failed to create stripe customer")
	}

	err = db.CreateStripeCustomer(ctx, s.conn, db.StripeCustomer{
		StripeCustomerID: customer.ID,
		AttributionID:    attributionID,
		CreationTime:     db.NewVarCharTime(time.Unix(customer.Created, 0)),
		Currency:         req.GetCurrency(),
	})
	if err != nil {
		log.WithField("attribution_id", attributionID).WithField("stripe_customer_id", customer.ID).WithError(err).Error("Failed to store Stripe Customer in the database.")
		// We do not return an error to the caller here, as we did manage to create the stripe customer in Stripe and we can proceed with other flows
		// The StripeCustomer will be backfilled in the DB on the next GetStripeCustomer call by doing a search.
	}

	return &v1.CreateStripeCustomerResponse{
		Customer: convertStripeCustomer(customer),
	}, nil
}

func (s *BillingService) CreateStripeSubscription(ctx context.Context, req *v1.CreateStripeSubscriptionRequest) (*v1.CreateStripeSubscriptionResponse, error) {
	attributionID, err := db.ParseAttributionID(req.GetAttributionId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Invalid attribution ID %s", attributionID)
	}

	customer, err := s.GetStripeCustomer(ctx, &v1.GetStripeCustomerRequest{
		Identifier: &v1.GetStripeCustomerRequest_AttributionId{
			AttributionId: string(attributionID),
		},
	})
	if err != nil {
		return nil, err
	}

	_, err = s.stripeClient.SetDefaultPaymentForCustomer(ctx, customer.Customer.Id, req.SetupIntentId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Failed to set default payment for customer ID %s", customer.Customer.Id)
	}

	stripeCustomer, err := s.stripeClient.GetCustomer(ctx, customer.Customer.Id)
	if err != nil {
		return nil, err
	}
	// if the customer has a subscription, return error
	for _, subscription := range stripeCustomer.Subscriptions.Data {
		if subscription.Status != "canceled" {
			return nil, status.Errorf(codes.AlreadyExists, "Customer (%s) already has an active subscription (%s)", attributionID, subscription.ID)
		}
	}

	priceID, err := getPriceIdentifier(attributionID, stripeCustomer, s)
	if err != nil {
		return nil, err
	}

	var isAutomaticTaxSupported bool
	if stripeCustomer.Tax != nil {
		isAutomaticTaxSupported = stripeCustomer.Tax.AutomaticTax == "supported"
	}
	if !isAutomaticTaxSupported {
		log.Warnf("Automatic Stripe tax is not supported for customer %s", stripeCustomer.ID)
	}

	subscription, err := s.stripeClient.CreateSubscription(ctx, stripeCustomer.ID, priceID, isAutomaticTaxSupported)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to create subscription with customer ID %s", customer.Customer.Id)
	}

	return &v1.CreateStripeSubscriptionResponse{
		Subscription: &v1.StripeSubscription{
			Id: subscription.ID,
		},
	}, nil
}

func getPriceIdentifier(attributionID db.AttributionID, stripeCustomer *stripe_api.Customer, s *BillingService) (string, error) {
	preferredCurrency := stripeCustomer.Metadata["preferredCurrency"]
	if stripeCustomer.Metadata["preferredCurrency"] == "" {
		log.
			WithField("stripe_customer_id", stripeCustomer.ID).
			Warn("No preferred currency set. Defaulting to USD")
	}

	entity, _ := attributionID.Values()

	switch entity {
	case db.AttributionEntity_User:
		switch preferredCurrency {
		case "EUR":
			return s.stripePrices.IndividualUsagePriceIDs.EUR, nil
		default:
			return s.stripePrices.IndividualUsagePriceIDs.USD, nil
		}

	case db.AttributionEntity_Team:
		switch preferredCurrency {
		case "EUR":
			return s.stripePrices.TeamUsagePriceIDs.EUR, nil
		default:
			return s.stripePrices.TeamUsagePriceIDs.USD, nil
		}

	default:
		return "", status.Errorf(codes.InvalidArgument, "Invalid currency %s for customer ID %s", stripeCustomer.Metadata["preferredCurrency"], stripeCustomer.ID)
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
	usage, err := InternalComputeInvoiceUsage(ctx, invoice)
	if err != nil {
		return nil, err
	}
	err = db.InsertUsage(ctx, s.conn, usage)
	if err != nil {
		logger.WithError(err).Errorf("Failed to insert Invoice usage record into the db.")
		return nil, status.Errorf(codes.Internal, "Failed to insert Invoice into usage records.")
	}
	logger.WithField("usage_id", usage.ID).Infof("Inserted usage record into database for %f credits against %s attribution", usage.CreditCents.ToCredits(), usage.AttributionID)

	_, err = s.ccManager.IncrementBillingCycle(ctx, usage.AttributionID)
	if err != nil {
		// we are just logging at this point, so that we don't see the event again as the usage has been recorded.
		logger.WithError(err).Errorf("Failed to increment billing cycle.")
	}
	return &v1.FinalizeInvoiceResponse{}, nil
}

func InternalComputeInvoiceUsage(ctx context.Context, invoice *stripe_api.Invoice) (db.Usage, error) {
	logger := log.WithField("invoice_id", invoice.ID)
	attributionID, err := stripe.GetAttributionID(ctx, invoice.Customer)
	if err != nil {
		return db.Usage{}, err
	}
	logger = logger.WithField("attributionID", attributionID)
	finalizedAt := time.Unix(invoice.StatusTransitions.FinalizedAt, 0)

	logger = logger.
		WithField("attribution_id", attributionID).
		WithField("invoice_finalized_at", finalizedAt)

	if invoice.Lines == nil || len(invoice.Lines.Data) == 0 {
		logger.Errorf("Invoice %s did not contain any lines  so we cannot extract quantity to reflect it in usage.", invoice.ID)
		return db.Usage{}, status.Errorf(codes.Internal, "Invoice did not contain any lines.")
	}

	lines := invoice.Lines.Data
	var creditsOnInvoice int64
	for _, line := range lines {
		creditsOnInvoice += line.Quantity
	}

	return db.Usage{
		ID:            uuid.New(),
		AttributionID: attributionID,
		Description:   fmt.Sprintf("Invoice %s finalized in Stripe", invoice.ID),
		// Apply negative value of credits to reduce accrued credit usage
		CreditCents:   db.NewCreditCents(float64(-creditsOnInvoice)),
		EffectiveTime: db.NewVarCharTime(finalizedAt),
		Kind:          db.InvoiceUsageKind,
		Draft:         false,
		Metadata:      nil,
	}, nil
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

func (s *BillingService) storeStripeCustomer(ctx context.Context, cus *stripe_api.Customer, attributionID db.AttributionID) (*v1.StripeCustomer, error) {
	err := db.CreateStripeCustomer(ctx, s.conn, db.StripeCustomer{
		StripeCustomerID: cus.ID,
		AttributionID:    attributionID,
		Currency:         cus.Metadata[stripe.PreferredCurrencyMetadataKey],
		// We use the original Stripe supplied creation timestamp, this ensures that we stay true to our ordering of customer creation records.
		CreationTime: db.NewVarCharTime(time.Unix(cus.Created, 0)),
	})
	if err != nil {
		return nil, err
	}

	return &v1.StripeCustomer{
		Id:       cus.ID,
		Currency: cus.Metadata[stripe.PreferredCurrencyMetadataKey],
	}, nil
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

func convertStripeCustomer(customer *stripe_api.Customer) *v1.StripeCustomer {
	return &v1.StripeCustomer{
		Id:       customer.ID,
		Currency: customer.Metadata[stripe.PreferredCurrencyMetadataKey],
	}
}

func convertDBStripeCustomerToResponse(cus db.StripeCustomer) *v1.StripeCustomer {
	return &v1.StripeCustomer{
		Id:       cus.StripeCustomerID,
		Currency: cus.Currency,
	}
}
