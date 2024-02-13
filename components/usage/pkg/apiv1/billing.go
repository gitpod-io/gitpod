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

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	experimental_v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/google/uuid"
	stripe_api "github.com/stripe/stripe-go/v72"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

func NewBillingService(stripeClient *stripe.Client, conn *gorm.DB, ccManager *db.CostCenterManager, stripePrices stripe.StripePrices, teamsService v1connect.TeamsServiceClient, userService v1connect.UserServiceClient) *BillingService {
	return &BillingService{
		stripeClient: stripeClient,
		conn:         conn,
		ccManager:    ccManager,
		stripePrices: stripePrices,

		teamsService: teamsService,
		userService:  userService,
	}
}

type BillingService struct {
	conn         *gorm.DB
	stripeClient *stripe.Client
	ccManager    *db.CostCenterManager
	stripePrices stripe.StripePrices

	teamsService v1connect.TeamsServiceClient
	userService  v1connect.UserServiceClient

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

	updateStripeCustomer := func(stripeCustomerID string) (db.StripeCustomer, error) {
		stripeCustomer, err := s.stripeClient.GetCustomer(ctx, stripeCustomerID)
		if err != nil {
			return db.StripeCustomer{}, err
		}

		customer, err := db.UpdateStripeCustomerInvalidBillingAddress(ctx, s.conn, stripeCustomer.ID, stripeCustomer.Tax.AutomaticTax == stripe_api.CustomerTaxAutomaticTaxUnrecognizedLocation)
		if err != nil {
			return db.StripeCustomer{}, err
		}

		return customer, nil
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

			return nil, status.Errorf(codes.NotFound, "Failed to lookup stripe customer from DB: %s", err.Error())
		} else if customer.InvalidBillingAddress == nil {
			// Update field for old entries in db
			customer, err = updateStripeCustomer(customer.StripeCustomerID)
			if err != nil {
				logger.WithError(err).Error("Failed to update stripe customer from DB")
			}
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
		} else if customer.InvalidBillingAddress == nil {
			// Update field for old entries in db
			customer, err = updateStripeCustomer(customer.StripeCustomerID)
			if err != nil {
				logger.WithError(err).Error("Failed to update stripe customer from DB")
			}
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
		AttributionID:        string(attributionID),
		Currency:             req.GetCurrency(),
		Email:                req.GetEmail(),
		Name:                 req.GetName(),
		BillingCreatorUserID: req.GetBillingCreatorUserId(),
	})
	if err != nil {
		log.WithError(err).Errorf("Failed to create stripe customer.")
		return nil, status.Errorf(codes.Internal, "Failed to create stripe customer")
	}

	err = db.CreateStripeCustomer(ctx, s.conn, db.StripeCustomer{
		StripeCustomerID:      customer.ID,
		AttributionID:         attributionID,
		CreationTime:          db.NewVarCharTime(time.Unix(customer.Created, 0)),
		Currency:              req.GetCurrency(),
		InvalidBillingAddress: db.BoolPointer(true), // true as address is empty
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

func (s *BillingService) CreateHoldPaymentIntent(ctx context.Context, req *v1.CreateHoldPaymentIntentRequest) (*v1.CreateHoldPaymentIntentResponse, error) {
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
		log.WithError(err).Errorf("Failed to find stripe customer.")
		return nil, status.Errorf(codes.Internal, "Failed to find stripe customer")
	}
	stripeCustomer, err := s.stripeClient.GetCustomer(ctx, customer.Customer.Id)
	if err != nil {
		log.WithError(err).Errorf("Failed to get customer from stripe.")
		return nil, status.Errorf(codes.Internal, "Failed to get customer from stripe.")
	}

	// Create a payment intent for 1.00 to test the card with a hold
	holdPaymentIntent, err := s.stripeClient.CreateHoldPaymentIntent(ctx, stripeCustomer, 100)
	if err != nil {
		log.WithError(err).Errorf("Failed to create a payment intent to for playing a hold.")
		return nil, status.Errorf(codes.Internal, "Failed to create a payment intent to for playing a hold.")
	}

	// This gets passed to the client where it can be confirmed/verified by the user
	return &v1.CreateHoldPaymentIntentResponse{
		PaymentIntentId:           holdPaymentIntent.ID,
		PaymentIntentClientSecret: holdPaymentIntent.ClientSecret,
	}, nil
}

func (s *BillingService) CreateStripeSubscription(ctx context.Context, req *v1.CreateStripeSubscriptionRequest) (*v1.CreateStripeSubscriptionResponse, error) {
	attributionID, err := db.ParseAttributionID(req.GetAttributionId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Invalid attribution ID %s", attributionID)
	}

	paymentIntentID := req.PaymentIntentId
	if paymentIntentID == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Invalid payment_intent_id")
	}

	customer, err := s.GetStripeCustomer(ctx, &v1.GetStripeCustomerRequest{
		Identifier: &v1.GetStripeCustomerRequest_AttributionId{
			AttributionId: string(attributionID),
		},
	})
	if err != nil {
		return nil, err
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

	// Handle a payment hold for the payment intent
	// Make sure the provided payment intent hold was successful, and release it
	result, err := s.stripeClient.TryHoldAmountForPaymentIntent(ctx, stripeCustomer, string(paymentIntentID))
	if err != nil {
		log.WithError(err).Errorf("Failed to verify credit card for customer %s", stripeCustomer.ID)
	}
	if result != stripe.PaymentHoldResultSucceeded {
		log.Errorf("Failed to verify credit card for customer %s. Result: %s", stripeCustomer.ID, result)
		return nil, status.Error(codes.InvalidArgument, "The provided payment method is invalid. Please provide working credit card information to proceed.")
	}

	// At this point we should have a valid payment method, so we can set it as default.
	_, err = s.stripeClient.SetDefaultPaymentForCustomer(ctx, customer.Customer.Id, string(paymentIntentID))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Failed to set default payment for customer ID %s", customer.Customer.Id)
	}

	// Customers are created without a valid address by default,
	// `SetDefaultPaymentForCustomer` will update the customer address to the one provided in the payment modal.
	// Request the customer data again so the `Tax` property is properly set.
	stripeCustomer, err = s.stripeClient.GetCustomer(ctx, customer.Customer.Id)
	if err != nil {
		return nil, err
	}

	var isAutomaticTaxSupported bool
	if stripeCustomer.Tax != nil {
		isAutomaticTaxSupported = stripeCustomer.Tax.AutomaticTax == stripe_api.CustomerTaxAutomaticTaxSupported
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

func (s *BillingService) UpdateCustomerSubscriptionsTaxState(ctx context.Context, req *v1.UpdateCustomerSubscriptionsTaxStateRequest) (*v1.UpdateCustomerSubscriptionsTaxStateResponse, error) {
	if req.GetCustomerId() == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Missing CustomerID")
	}

	stripeCustomer, err := s.stripeClient.GetCustomer(ctx, req.GetCustomerId())
	if err != nil {
		log.WithError(err).Error("Failed to retrieve customer from Stripe.")
		return nil, status.Errorf(codes.NotFound, "Failed to get customer with ID %s: %s", req.GetCustomerId(), err.Error())
	}

	var isAutomaticTaxSupported bool
	if stripeCustomer.Tax != nil {
		isAutomaticTaxSupported = stripeCustomer.Tax.AutomaticTax == stripe_api.CustomerTaxAutomaticTaxSupported

		_, err = db.UpdateStripeCustomerInvalidBillingAddress(ctx, s.conn, stripeCustomer.ID, stripeCustomer.Tax.AutomaticTax == stripe_api.CustomerTaxAutomaticTaxUnrecognizedLocation)
		if err != nil {
			log.WithError(err).Error("Failed to update stripe customer from DB")
		}
	}
	if !isAutomaticTaxSupported {
		log.Warnf("Automatic Stripe tax is not supported for customer %s", stripeCustomer.ID)
	}

	for _, subscription := range stripeCustomer.Subscriptions.Data {
		if subscription.Status != "canceled" && subscription.AutomaticTax.Enabled != isAutomaticTaxSupported {
			_, err := s.stripeClient.UpdateSubscriptionAutomaticTax(ctx, subscription.ID, isAutomaticTaxSupported)
			if err != nil {
				log.WithError(err).Errorf("Failed to update subscription automaticTax with ID %s", subscription.ID)
			} else {
				log.Infof("Updated subscription automatic tax supported with ID %s", subscription.ID)
			}
		}
	}

	return &v1.UpdateCustomerSubscriptionsTaxStateResponse{}, nil
}

func getPriceIdentifier(attributionID db.AttributionID, stripeCustomer *stripe_api.Customer, s *BillingService) (string, error) {
	preferredCurrency := stripeCustomer.Metadata["preferredCurrency"]
	if stripeCustomer.Metadata["preferredCurrency"] == "" {
		log.
			WithField("stripe_customer_id", stripeCustomer.ID).
			Warn("No preferred currency set. Defaulting to USD")
	}

	switch preferredCurrency {
	case "EUR":
		return s.stripePrices.TeamUsagePriceIDs.EUR, nil
	default:
		return s.stripePrices.TeamUsagePriceIDs.USD, nil
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
	err = s.ReconcileStripeCustomers(ctx)
	if err != nil {
		log.WithError(err).Errorf("Failed to reconcile stripe customers.")
	}

	return &v1.ReconcileInvoicesResponse{}, nil
}

func (s *BillingService) ReconcileStripeCustomers(ctx context.Context) error {
	log.Info("Reconciling stripe customers")
	var costCenters []db.CostCenter
	result := s.conn.Raw("SELECT * from d_b_cost_center where creationTime in (SELECT max(creationTime) from d_b_cost_center group by id) and nextBillingTime < creationTime and billingStrategy='stripe'").Scan(&costCenters)
	if result.Error != nil {
		return result.Error
	}

	log.Infof("Found %d cost centers to reconcile", len(costCenters))

	for _, costCenter := range costCenters {
		log.Infof("Reconciling stripe invoices for cost center %s", costCenter.ID)
		err := s.reconcileFromStripeInvoices(ctx, costCenter.ID)
		if err != nil {
			log.WithError(err).Errorf("Failed to reconcile stripe invoices for cost center %s", costCenter.ID)
			continue
		}
	}
	return nil
}

func (s *BillingService) reconcileFromStripeInvoices(ctx context.Context, id db.AttributionID) error {
	cust, err := s.stripeClient.GetCustomerByAttributionID(ctx, string(id))
	if err != nil {
		return err
	}
	invoices, err := s.stripeClient.ListInvoices(ctx, cust.ID)
	if err != nil {
		return err
	}
	for _, invoice := range invoices {
		if invoice.Status == "paid" {
			// TODO: make it part of reconcileStripeInvoices to also update CostCenters

			usage, err := InternalComputeInvoiceUsage(ctx, invoice, cust)
			if err != nil {
				return err
			}
			// check if a usage entry exists for this invoice
			var existingUsage db.Usage
			result := s.conn.First(&existingUsage, "description = ?", usage.Description)
			if result.Error != nil {
				if errors.Is(result.Error, gorm.ErrRecordNotFound) {
					log.Infof("No usage entry found for invoice %s. Inserting one now.", invoice.ID)
					err = db.InsertUsage(ctx, s.conn, usage)
					if err != nil {
						return err
					}
				} else {
					return result.Error
				}
			}
		}
	}
	return nil
}

func (s *BillingService) FinalizeInvoice(ctx context.Context, in *v1.FinalizeInvoiceRequest) (*v1.FinalizeInvoiceResponse, error) {
	logger := log.WithField("invoice_id", in.GetInvoiceId())
	logger.Info("Invoice finalized. Recording usage.")

	if in.GetInvoiceId() == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Missing InvoiceID")
	}

	invoice, err := s.stripeClient.GetInvoiceWithCustomer(ctx, in.GetInvoiceId())
	if err != nil {
		logger.WithError(err).Error("Failed to retrieve invoice from Stripe.")
		return nil, status.Errorf(codes.NotFound, "Failed to get invoice with ID %s: %s", in.GetInvoiceId(), err.Error())
	}
	usage, err := InternalComputeInvoiceUsage(ctx, invoice, invoice.Customer)
	if err != nil {
		return nil, err
	}
	err = db.InsertUsage(ctx, s.conn, usage)
	if err != nil {
		logger.WithError(err).Errorf("Failed to insert Invoice usage record into the db.")
		return nil, status.Errorf(codes.Internal, "Failed to insert Invoice into usage records.")
	}
	logger.WithField("usage_id", usage.ID).Infof("Inserted usage record into database for %f credits against %s attribution", usage.CreditCents.ToCredits(), usage.AttributionID)

	if invoice.BillingReason == "subscription_cycle" {
		// Increment billing cycle
		periodStart := time.Unix(invoice.PeriodStart, 0)
		periodEnd := time.Unix(invoice.PeriodEnd, 0)

		_, err = s.ccManager.IncrementBillingCycleStripe(ctx, usage.AttributionID, periodStart, periodEnd)
		if err != nil {
			// we are just logging at this point, so that we don't see the event again as the usage has been recorded.
			logger.WithError(err).Errorf("Failed to increment billing cycle.")
		}
	}

	// update stripe with current usage immediately, so that invoices created between now and the next reconcile are correct.
	newBalance, err := db.GetBalance(ctx, s.conn, usage.AttributionID)
	if err != nil {
		// we are just logging at this point, so that we don't see the event again as the usage has been recorded.
		logger.WithError(err).Errorf("Failed to compute new balance.")
		return &v1.FinalizeInvoiceResponse{}, nil
	}
	err = s.stripeClient.UpdateUsage(ctx, map[db.AttributionID]int64{
		usage.AttributionID: int64(math.Ceil(newBalance.ToCredits())),
	})
	if err != nil {
		// we are just logging at this point, so that we don't see the event again as the usage has been recorded.
		log.WithError(err).Errorf("Failed to udpate usage in stripe after receiving invoive.finalized.")
	}
	return &v1.FinalizeInvoiceResponse{}, nil
}

func InternalComputeInvoiceUsage(ctx context.Context, invoice *stripe_api.Invoice, customer *stripe_api.Customer) (db.Usage, error) {
	logger := log.WithField("invoice_id", invoice.ID)
	attributionID, err := stripe.GetAttributionID(ctx, customer)
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

func (s *BillingService) OnChargeDispute(ctx context.Context, req *v1.OnChargeDisputeRequest) (*v1.OnChargeDisputeResponse, error) {
	if req.DisputeId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "dispute ID is required")
	}

	logger := log.WithContext(ctx).WithField("disputeId", req.DisputeId)

	dispute, err := s.stripeClient.GetDispute(ctx, req.DisputeId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to retrieve dispute ID %s from stripe", req.DisputeId)
	}

	if dispute.PaymentIntent == nil || dispute.PaymentIntent.Customer == nil {
		return nil, status.Errorf(codes.Internal, "dispute did not contain customer of payment intent in expanded fields")
	}

	customer := dispute.PaymentIntent.Customer
	logger = logger.WithField("customerId", customer.ID)

	attributionIDValue, ok := customer.Metadata[stripe.AttributionIDMetadataKey]
	if !ok {
		return nil, status.Errorf(codes.Internal, "Customer %s object did not contain attribution ID in metadata", customer.ID)
	}

	logger = logger.WithField("attributionId", attributionIDValue)

	attributionID, err := db.ParseAttributionID(attributionIDValue)
	if err != nil {
		log.WithError(err).Errorf("Failed to parse attribution ID from customer metadata.")
		return nil, status.Errorf(codes.Internal, "failed to parse attribution ID from customer metadata")
	}

	var userIDsToBlock []string
	_, id := attributionID.Values()
	team, err := s.teamsService.GetTeam(ctx, connect.NewRequest(&experimental_v1.GetTeamRequest{
		TeamId: id,
	}))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to lookup team details for team ID: %s", id)
	}

	for _, member := range team.Msg.GetTeam().GetMembers() {
		if member.GetRole() != experimental_v1.TeamRole_TEAM_ROLE_OWNER {
			continue
		}
		userIDsToBlock = append(userIDsToBlock, member.GetUserId())
	}

	logger = logger.WithField("teamOwners", userIDsToBlock)

	logger.Infof("Identified %d users to block based on charge dispute", len(userIDsToBlock))
	var errs []error
	for _, userToBlock := range userIDsToBlock {
		_, err := s.userService.BlockUser(ctx, connect.NewRequest(&experimental_v1.BlockUserRequest{
			UserId: userToBlock,
			Reason: fmt.Sprintf("User has created a Stripe dispute ID: %s", req.GetDisputeId()),
		}))
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to block user %s: %w", userToBlock, err))
		}
	}

	if len(errs) > 0 {
		return nil, status.Errorf(codes.Internal, "failed to block users: %v", errs)
	}

	return &v1.OnChargeDisputeResponse{}, nil
}

func (s *BillingService) getPriceId(ctx context.Context, attributionId string) string {
	defaultPriceId := s.stripePrices.TeamUsagePriceIDs.USD
	attributionID, err := db.ParseAttributionID(attributionId)
	if err != nil {
		log.Errorf("Failed to parse attribution ID %s: %s", attributionId, err.Error())
		return defaultPriceId
	}

	customer, err := s.GetStripeCustomer(ctx, &v1.GetStripeCustomerRequest{
		Identifier: &v1.GetStripeCustomerRequest_AttributionId{
			AttributionId: string(attributionID),
		},
	})
	if err != nil {
		if status.Code(err) != codes.NotFound {
			log.Errorf("Failed to get stripe customer for attribution ID %s: %s", attributionId, err.Error())
		}
		return defaultPriceId
	}

	stripeCustomer, err := s.stripeClient.GetCustomer(ctx, customer.Customer.Id)
	if err != nil {
		log.Errorf("Failed to get customer infromation from stripe for customer ID %s: %s", customer.Customer.Id, err.Error())
		return defaultPriceId
	}

	// if the customer has an active subscription, return that information
	for _, subscription := range stripeCustomer.Subscriptions.Data {
		if subscription.Status != "canceled" {
			return subscription.Plan.ID
		}
	}
	priceID, err := getPriceIdentifier(attributionID, stripeCustomer, s)
	if err != nil {
		log.Errorf("Failed to get price identifier for attribution ID %s: %s", attributionId, err.Error())
		return defaultPriceId
	}
	return priceID
}

func (s *BillingService) GetPriceInformation(ctx context.Context, req *v1.GetPriceInformationRequest) (*v1.GetPriceInformationResponse, error) {
	_, err := db.ParseAttributionID(req.GetAttributionId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Invalid attribution ID %s", req.GetAttributionId())
	}
	priceID := s.getPriceId(ctx, req.GetAttributionId())
	price, err := s.stripeClient.GetPriceInformation(ctx, priceID)
	if err != nil {
		return nil, err
	}
	information := price.Metadata["human_readable_description"]
	if information == "" {
		information = "No information available"
	}
	return &v1.GetPriceInformationResponse{
		HumanReadableDescription: information,
	}, nil
}

func (s *BillingService) storeStripeCustomer(ctx context.Context, cus *stripe_api.Customer, attributionID db.AttributionID) (*v1.StripeCustomer, error) {
	var invalidBillingAddress *bool
	if cus.Tax != nil {
		invalidBillingAddress = db.BoolPointer(cus.Tax.AutomaticTax == stripe_api.CustomerTaxAutomaticTaxUnrecognizedLocation)
	}

	err := db.CreateStripeCustomer(ctx, s.conn, db.StripeCustomer{
		StripeCustomerID:      cus.ID,
		AttributionID:         attributionID,
		Currency:              cus.Metadata[stripe.PreferredCurrencyMetadataKey],
		InvalidBillingAddress: invalidBillingAddress,
		// We use the original Stripe supplied creation timestamp, this ensures that we stay true to our ordering of customer creation records.
		CreationTime: db.NewVarCharTime(time.Unix(cus.Created, 0)),
	})
	if err != nil {
		return nil, err
	}

	return convertStripeCustomer(cus), nil
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
	var invalidBillingAddress bool
	if customer.Tax != nil {
		invalidBillingAddress = customer.Tax.AutomaticTax == stripe_api.CustomerTaxAutomaticTaxUnrecognizedLocation
	}
	return &v1.StripeCustomer{
		Id:                    customer.ID,
		Currency:              customer.Metadata[stripe.PreferredCurrencyMetadataKey],
		InvalidBillingAddress: invalidBillingAddress,
	}
}

func convertDBStripeCustomerToResponse(cus db.StripeCustomer) *v1.StripeCustomer {
	var invalidBillingAddress bool
	if cus.InvalidBillingAddress != nil {
		invalidBillingAddress = *cus.InvalidBillingAddress
	}
	return &v1.StripeCustomer{
		Id:                    cus.StripeCustomerID,
		Currency:              cus.Currency,
		InvalidBillingAddress: invalidBillingAddress,
	}
}
