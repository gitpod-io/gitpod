// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package stripe

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/client"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	// Metadata keys are used for storing additional context in Stripe
	AttributionIDMetadataKey        = "attributionId"
	PreferredCurrencyMetadataKey    = "preferredCurrency"
	BillingCreaterUserIDMetadataKey = "billingCreatorUserId"
)

type Client struct {
	sc *client.API
}

type ClientConfig struct {
	PublishableKey string `json:"publishableKey"`
	SecretKey      string `json:"secretKey"`
}

type PriceConfig struct {
	EUR string `json:"eur"`
	USD string `json:"usd"`
}

type StripePrices struct {
	IndividualUsagePriceIDs PriceConfig `json:"individualUsagePriceIds"`
	TeamUsagePriceIDs       PriceConfig `json:"teamUsagePriceIds"`
}

func ReadConfigFromFile(path string) (ClientConfig, error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return ClientConfig{}, fmt.Errorf("failed to read stripe client config: %w", err)
	}

	var config ClientConfig
	err = json.Unmarshal(bytes, &config)
	if err != nil {
		return ClientConfig{}, fmt.Errorf("failed to unmarshal Stripe Client config: %w", err)
	}

	return config, nil
}

// New authenticates a Stripe client using the provided config
func New(config ClientConfig) (*Client, error) {
	return NewWithHTTPClient(config, &http.Client{
		Transport: http.DefaultTransport,
		Timeout:   10 * time.Second,
	})
}

func NewWithHTTPClient(config ClientConfig, c *http.Client) (*Client, error) {
	sc := &client.API{}

	sc.Init(config.SecretKey, stripe.NewBackends(c))

	return &Client{sc: sc}, nil
}

type UsageRecord struct {
	SubscriptionItemID string
	Quantity           int64
}

type Invoice struct {
	ID             string
	SubscriptionID string
	Amount         int64
	Currency       string
	Credits        int64
}

// UpdateUsage updates teams' Stripe subscriptions with usage data
// `usageForTeam` is a map from team name to total workspace seconds used within a billing period.
func (c *Client) UpdateUsage(ctx context.Context, creditsPerAttributionID map[db.AttributionID]int64) error {
	queries := queriesForCustomersWithAttributionIDs(creditsPerAttributionID)

	for _, query := range queries {
		logger := log.WithField("stripe_query", query)

		customers, err := c.findCustomers(ctx, query)
		if err != nil {
			return fmt.Errorf("failed to find customers: %w", err)
		}

		for _, customer := range customers {
			attributionIDRaw := customer.Metadata[AttributionIDMetadataKey]
			logger.Infof("Found customer %q for attribution ID %q", customer.Name, attributionIDRaw)

			attributionID, err := db.ParseAttributionID(attributionIDRaw)
			if err != nil {
				logger.WithError(err).Error("Failed to parse attribution ID from Stripe metadata.")
				continue
			}

			lgr := logger.
				WithField("customer_id", customer.ID).
				WithField("customer_name", customer.Name).
				WithField("subscriptions", customer.Subscriptions).
				WithField("attribution_id", attributionID)

			err = c.updateUsageForCustomer(ctx, customer, creditsPerAttributionID[attributionID])
			if err != nil {
				lgr.WithError(err).Errorf("Failed to update usage.")
			}
			reportStripeUsageUpdate(err)
		}
	}
	return nil
}

func (c *Client) findCustomers(ctx context.Context, query string) (customers []*stripe.Customer, err error) {
	now := time.Now()
	reportStripeRequestStarted("customers_search")
	defer func() {
		reportStripeRequestCompleted("customers_search", err, time.Since(now))
	}()

	params := &stripe.CustomerSearchParams{
		SearchParams: stripe.SearchParams{
			Query:   query,
			Expand:  []*string{stripe.String("data.subscriptions")},
			Context: ctx,
		},
	}
	iter := c.sc.Customers.Search(params)

	for iter.Next() {
		customers = append(customers, iter.Customer())
	}
	if iter.Err() != nil {
		return nil, fmt.Errorf("failed to search for customers: %w", iter.Err())
	}

	return customers, nil
}

func (c *Client) updateUsageForCustomer(ctx context.Context, customer *stripe.Customer, credits int64) (err error) {
	logger := log.
		WithField("customer_id", customer.ID).
		WithField("customer_name", customer.Name).
		WithField("credits", credits)
	if credits < 0 {
		logger.Infof("Received request to update customer %s usage to negative value, updating to 0 instead.", customer.ID)

		// nullify any existing usage, but do not set it to negative value - negative invoice doesn't make sense...
		credits = 0
	}

	subscriptions := customer.Subscriptions.Data
	if len(subscriptions) == 0 {
		logger.Info("Customer does not have a valid (one) subscription. This happens when a customer has cancelled their subscription but still exist as a Customer in stripe.")
		return nil
	}
	if len(subscriptions) > 1 {
		return fmt.Errorf("customer has more than 1 subscription (got: %d), this is a consistency error and requires a manual intervention", len(subscriptions))
	}

	subscription := customer.Subscriptions.Data[0]

	log.Infof("Customer has subscription: %q", subscription.ID)
	if len(subscription.Items.Data) != 1 {
		return fmt.Errorf("subscription %s has an unexpected number of subscriptionItems (expected 1, got %d)", subscription.ID, len(subscription.Items.Data))
	}

	subscriptionItemId := subscription.Items.Data[0].ID
	log.Infof("Registering usage against subscriptionItem %q", subscriptionItemId)

	reportStripeRequestStarted("usage_record_update")
	now := time.Now()
	defer func() {
		reportStripeRequestCompleted("usage_record_update", err, time.Since(now))
	}()
	_, err = c.sc.UsageRecords.New(&stripe.UsageRecordParams{
		Params: stripe.Params{
			Context: ctx,
		},
		SubscriptionItem: stripe.String(subscriptionItemId),
		Quantity:         stripe.Int64(credits),
	})
	if err != nil {
		return fmt.Errorf("failed to register usage for customer %q on subscription item %s", customer.Name, subscriptionItemId)
	}

	return nil
}

func (c *Client) GetCustomerByAttributionID(ctx context.Context, attributionID string) (*stripe.Customer, error) {
	customers, err := c.findCustomers(ctx, fmt.Sprintf("metadata['attributionId']:'%s'", attributionID))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to find customers: %v", err)
	}

	if len(customers) == 0 {
		return nil, status.Errorf(codes.NotFound, "no customer found for attribution_id: %s", attributionID)
	}
	if len(customers) > 1 {
		return nil, status.Errorf(codes.FailedPrecondition, "found multiple customers for attributiuon_id: %s", attributionID)
	}

	return customers[0], nil
}

func (c *Client) GetCustomer(ctx context.Context, customerID string) (customer *stripe.Customer, err error) {
	now := time.Now()
	reportStripeRequestStarted("customer_get")
	defer func() {
		reportStripeRequestCompleted("customer_get", err, time.Since(now))
	}()

	customer, err = c.sc.Customers.Get(customerID, &stripe.CustomerParams{
		Params: stripe.Params{
			Context: ctx,
			Expand:  []*string{stripe.String("tax"), stripe.String("subscriptions")},
		},
	})
	if err != nil {
		if stripeErr, ok := err.(*stripe.Error); ok {
			switch stripeErr.Code {
			case stripe.ErrorCodeMissing:
				return nil, status.Errorf(codes.NotFound, "customer %s does not exist in stripe", customerID)
			}
		}

		return nil, fmt.Errorf("failed to get customer by customer ID %s", customerID)
	}

	return customer, nil
}

func (c *Client) GetPriceInformation(ctx context.Context, priceID string) (price *stripe.Price, err error) {
	now := time.Now()
	reportStripeRequestStarted("prices_get")
	defer func() {
		reportStripeRequestCompleted("prices_get", err, time.Since(now))
	}()

	price, err = c.sc.Prices.Get(priceID, &stripe.PriceParams{
		Params: stripe.Params{
			Context: ctx,
		},
	})
	if err != nil {
		if stripeErr, ok := err.(*stripe.Error); ok {
			switch stripeErr.Code {
			case stripe.ErrorCodeMissing:
				return nil, status.Errorf(codes.NotFound, "price %s does not exist in stripe", priceID)
			}
		}

		return nil, fmt.Errorf("failed to get price by price ID %s", priceID)
	}

	return price, nil
}

type CreateCustomerParams struct {
	AttributionID        string
	Currency             string
	Email                string
	Name                 string
	BillingCreatorUserID string
}

func (c *Client) CreateCustomer(ctx context.Context, params CreateCustomerParams) (customer *stripe.Customer, err error) {
	now := time.Now()
	reportStripeRequestStarted("customers_create")
	defer func() {
		reportStripeRequestCompleted("customers_create", err, time.Since(now))
	}()

	customer, err = c.sc.Customers.New(&stripe.CustomerParams{
		Params: stripe.Params{
			Context: ctx,
			Metadata: map[string]string{
				// We set the preferred currency on the metadata such that we can later retreive it when we're creating a Subscription
				// This is also done to propagate the preference into the Customer such that we can inform them when their
				// new subscription would use a different currency to the previous one
				PreferredCurrencyMetadataKey:    params.Currency,
				AttributionIDMetadataKey:        params.AttributionID,
				BillingCreaterUserIDMetadataKey: params.BillingCreatorUserID,
			},
		},
		Email: stripe.String(params.Email),
		Name:  stripe.String(params.Name),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Stripe customer: %w", err)
	}
	return customer, nil
}

func (c *Client) GetInvoiceWithCustomer(ctx context.Context, invoiceID string) (invoice *stripe.Invoice, err error) {
	if invoiceID == "" {
		return nil, fmt.Errorf("no invoice ID specified")
	}

	now := time.Now()
	reportStripeRequestStarted("invoice_get")
	defer func() {
		reportStripeRequestCompleted("invoice_get", err, time.Since(now))
	}()

	invoice, err = c.sc.Invoices.Get(invoiceID, &stripe.InvoiceParams{
		Params: stripe.Params{
			Context: ctx,
			Expand:  []*string{stripe.String("customer")},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get invoice %s: %w", invoiceID, err)
	}
	return invoice, nil
}

func (c *Client) ListInvoices(ctx context.Context, customerId string) (invoices []*stripe.Invoice, err error) {
	if customerId == "" {
		return nil, fmt.Errorf("no customer ID specified")
	}

	now := time.Now()
	reportStripeRequestStarted("invoice_list")
	defer func() {
		reportStripeRequestCompleted("invoice_list", err, time.Since(now))
	}()

	invoicesResponse := c.sc.Invoices.List(&stripe.InvoiceListParams{
		Customer: stripe.String(customerId),
	})
	if invoicesResponse.Err() != nil {
		return nil, fmt.Errorf("failed to get invoices for customer %s: %w", customerId, invoicesResponse.Err())
	}
	return invoicesResponse.InvoiceList().Data, nil
}

func (c *Client) GetSubscriptionWithCustomer(ctx context.Context, subscriptionID string) (subscription *stripe.Subscription, err error) {
	if subscriptionID == "" {
		return nil, fmt.Errorf("no subscriptionID specified")
	}

	now := time.Now()
	reportStripeRequestStarted("subscription_get")
	defer func() {
		reportStripeRequestCompleted("subscription_get", err, time.Since(now))
	}()

	subscription, err = c.sc.Subscriptions.Get(subscriptionID, &stripe.SubscriptionParams{
		Params: stripe.Params{
			Expand: []*string{stripe.String("customer")},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription %s: %w", subscriptionID, err)
	}
	return subscription, nil
}

func (c *Client) CreateSubscription(ctx context.Context, customerID string, priceID string, isAutomaticTaxSupported bool) (*stripe.Subscription, error) {
	if customerID == "" {
		return nil, fmt.Errorf("no customerID specified")
	}
	if priceID == "" {
		return nil, fmt.Errorf("no priceID specified")
	}

	params := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(priceID),
			},
		},
		AutomaticTax: &stripe.SubscriptionAutomaticTaxParams{
			Enabled: stripe.Bool(isAutomaticTaxSupported),
		},
	}

	subscription, err := c.sc.Subscriptions.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription with customer ID %s", customerID)
	}

	return subscription, err
}

func (c *Client) SetDefaultPaymentForCustomer(ctx context.Context, customerID string, paymentIntentId string) (*stripe.Customer, error) {
	if customerID == "" {
		return nil, fmt.Errorf("no customerID specified")
	}

	if paymentIntentId == "" {
		return nil, fmt.Errorf("no paymentIntentId specified")
	}

	paymentIntent, err := c.sc.PaymentIntents.Get(paymentIntentId, &stripe.PaymentIntentParams{
		Params: stripe.Params{
			Context: ctx,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to retrieve payment intent with id %s", paymentIntentId)
	}

	paymentMethod, err := c.sc.PaymentMethods.Attach(paymentIntent.PaymentMethod.ID, &stripe.PaymentMethodAttachParams{Customer: &customerID})
	if err != nil {
		return nil, fmt.Errorf("Failed to attach payment method to payment intent ID %s", paymentIntentId)
	}

	customer, _ := c.sc.Customers.Update(customerID, &stripe.CustomerParams{
		InvoiceSettings: &stripe.CustomerInvoiceSettingsParams{
			DefaultPaymentMethod: stripe.String(paymentMethod.ID)},
		Address: &stripe.AddressParams{
			Line1:   stripe.String(paymentMethod.BillingDetails.Address.Line1),
			Country: stripe.String(paymentMethod.BillingDetails.Address.Country)}})
	if err != nil {
		return nil, fmt.Errorf("Failed to update customer with id %s", customerID)
	}

	return customer, nil
}

func (c *Client) CreateHoldPaymentIntent(ctx context.Context, customer *stripe.Customer, amountInCents int) (*stripe.PaymentIntent, error) {
	if customer == nil {
		return nil, fmt.Errorf("no customer specified")
	}

	currency := customer.Metadata["preferredCurrency"]
	if currency == "" {
		currency = string(stripe.CurrencyUSD)
	}

	// We create a payment intent with the amount we want to hold
	paymentIntent, err := c.sc.PaymentIntents.New(&stripe.PaymentIntentParams{
		Amount:   stripe.Int64(int64(amountInCents)),
		Currency: stripe.String(currency),
		Customer: stripe.String(customer.ID),
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
		// Place a hold on the funds when the customer authorizes the payment
		CaptureMethod: stripe.String(string(stripe.PaymentIntentCaptureMethodManual)),
		// This allows us to use this payment method for subscription payments
		SetupFutureUsage: stripe.String(string(stripe.PaymentIntentSetupFutureUsageOffSession)),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create hold payment intent: %w", err)
	}

	return paymentIntent, nil
}

func (c *Client) GetDispute(ctx context.Context, disputeID string) (dispute *stripe.Dispute, err error) {
	now := time.Now()
	reportStripeRequestStarted("dispute_get")
	defer func() {
		reportStripeRequestCompleted("dispute_get", err, time.Since(now))
	}()
	params := &stripe.DisputeParams{
		Params: stripe.Params{
			Context: ctx,
		},
	}
	params.AddExpand("payment_intent.customer")

	dispute, err = c.sc.Disputes.Get(disputeID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve dispute ID: %s", disputeID)
	}

	return dispute, nil
}

type PaymentHoldResult string

// List of values that PaymentIntentStatus can take
const (
	PaymentHoldResultRequiresAction        PaymentHoldResult = "requires_action"
	PaymentHoldResultRequiresConfirmation  PaymentHoldResult = "requires_confirmation"
	PaymentHoldResultRequiresPaymentMethod PaymentHoldResult = "requires_payment_method"
	PaymentHoldResultSucceeded             PaymentHoldResult = "succeeded"
	PaymentHoldResultFailed                PaymentHoldResult = "failed"
)

// TODO: We can replace this with TryHoldAmountForPaymentIntent once we use payment intents for the subscription flow
func (c *Client) TryHoldAmount(ctx context.Context, customer *stripe.Customer, amountInCents int) (PaymentHoldResult, error) {
	if customer == nil {
		return PaymentHoldResultFailed, fmt.Errorf("no customer specified")
	}

	if amountInCents <= 0 {
		return PaymentHoldResultFailed, fmt.Errorf("amountInCents must be greater than 0")
	}

	currency := customer.Metadata["preferredCurrency"]
	if currency == "" {
		currency = string(stripe.CurrencyUSD)
	}

	// we create a payment intent with the amount we want to hold
	// and then cancel it immediately
	paymentIntent, err := c.sc.PaymentIntents.New(&stripe.PaymentIntentParams{
		Amount:   stripe.Int64(int64(amountInCents)),
		Currency: stripe.String(currency),
		Customer: stripe.String(customer.ID),
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
		PaymentMethod: stripe.String(customer.InvoiceSettings.DefaultPaymentMethod.ID),
		CaptureMethod: stripe.String(string(stripe.PaymentIntentCaptureMethodManual)),
		Confirm:       stripe.Bool(true),
	})
	if err != nil {
		return PaymentHoldResultFailed, fmt.Errorf("failed to confirm payment intent: %w", err)
	}
	if paymentIntent.Status != stripe.PaymentIntentStatusRequiresCapture {
		result := PaymentHoldResultFailed
		if paymentIntent.Status == stripe.PaymentIntentStatusRequiresAction {
			result = PaymentHoldResultRequiresAction
		} else if paymentIntent.Status == stripe.PaymentIntentStatusRequiresConfirmation {
			result = PaymentHoldResultRequiresConfirmation
		} else if paymentIntent.Status == stripe.PaymentIntentStatusRequiresPaymentMethod {
			result = PaymentHoldResultRequiresPaymentMethod
		}
		return result, fmt.Errorf("Couldn't put a hold on the card: %s", paymentIntent.Status)
	}
	paymentIntent, err = c.sc.PaymentIntents.Cancel(paymentIntent.ID, nil)
	if err != nil {
		log.Errorf("Failed to cancel payment intent: %v", err)
		return PaymentHoldResultSucceeded, nil
	}
	if paymentIntent.Status != stripe.PaymentIntentStatusCanceled {
		log.Errorf("Failed to cancel payment intent: %v", err)
		return PaymentHoldResultSucceeded, nil
	}
	log.Info("Successfully put a hold on the card. Payment intent canceled.", customer.ID)
	return PaymentHoldResultSucceeded, nil
}

func (c *Client) TryHoldAmountForPaymentIntent(ctx context.Context, customer *stripe.Customer, holdPaymentIntentId string) (PaymentHoldResult, error) {
	if customer == nil {
		return PaymentHoldResultFailed, fmt.Errorf("no customer specified")
	}

	if holdPaymentIntentId == "" {
		return PaymentHoldResultFailed, fmt.Errorf("no payment intent specified for hold")
	}
	// ensure we cancel the payment intent so we remove the hold
	defer func(holdPaymentIntentId string) {
		paymentIntent, err := c.sc.PaymentIntents.Cancel(holdPaymentIntentId, nil)
		if err != nil {
			log.Errorf("Failed to cancel payment intent: %v", err)
			return
		}
		if paymentIntent.Status != stripe.PaymentIntentStatusCanceled {
			log.Errorf("Failed to cancel payment intent: %v", err)
			return
		}
		log.Debugf("Successfully cancelled payment intent %s", holdPaymentIntentId)
	}(holdPaymentIntentId)

	paymentIntent, err := c.sc.PaymentIntents.Get(holdPaymentIntentId, nil)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve payment intent: %w", err)
	}

	if paymentIntent.Status != stripe.PaymentIntentStatusRequiresCapture {
		result := PaymentHoldResultFailed
		if paymentIntent.Status == stripe.PaymentIntentStatusRequiresAction {
			result = PaymentHoldResultRequiresAction
		} else if paymentIntent.Status == stripe.PaymentIntentStatusRequiresConfirmation {
			result = PaymentHoldResultRequiresConfirmation
		} else if paymentIntent.Status == stripe.PaymentIntentStatusRequiresPaymentMethod {
			result = PaymentHoldResultRequiresPaymentMethod
		}
		return result, fmt.Errorf("Couldn't put a hold on the card: %s", paymentIntent.Status)
	}

	log.Info("Successfully put a hold on the card.", customer.ID)
	return PaymentHoldResultSucceeded, nil
}

func GetAttributionID(ctx context.Context, customer *stripe.Customer) (db.AttributionID, error) {
	if customer == nil {
		log.Error("No customer information available for invoice.")
		return "", status.Errorf(codes.Internal, "Failed to retrieve customer details from invoice.")
	}
	return db.ParseAttributionID(customer.Metadata[AttributionIDMetadataKey])
}

// queriesForCustomersWithAttributionIDs constructs Stripe query strings to find the Stripe Customer for each teamId
// It returns multiple queries, each being a big disjunction of subclauses so that we can process multiple teamIds in one query.
// `clausesPerQuery` is a limit enforced by the Stripe API.
func queriesForCustomersWithAttributionIDs(creditsByAttributionID map[db.AttributionID]int64) []string {
	attributionIDs := make([]string, 0, len(creditsByAttributionID))
	for k := range creditsByAttributionID {
		attributionIDs = append(attributionIDs, string(k))
	}
	sort.Strings(attributionIDs)

	const clausesPerQuery = 10
	var queries []string
	sb := strings.Builder{}

	for i := 0; i < len(attributionIDs); i += clausesPerQuery {
		sb.Reset()
		for j := 0; j < clausesPerQuery && i+j < len(attributionIDs); j++ {
			sb.WriteString(fmt.Sprintf("metadata['%s']:'%s'", AttributionIDMetadataKey, attributionIDs[i+j]))
			if j < clausesPerQuery-1 && i+j < len(attributionIDs)-1 {
				sb.WriteString(" OR ")
			}
		}
		queries = append(queries, sb.String())
	}

	return queries
}
