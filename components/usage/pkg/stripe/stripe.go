// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/client"
)

const (
	AttributionIDMetadataKey     = "attributionId"
	PreferredCurrencyMetadataKey = "preferredCurrency"
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

	sc.Init(config.SecretKey, stripe.NewBackends(&http.Client{
		Transport: http.DefaultTransport,
		Timeout:   10 * time.Second,
	}))

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
		return nil, status.Errorf(codes.NotFound, "no team customer found for attribution_id: %s", attributionID)
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

type CreateCustomerParams struct {
	AttributuonID string
	Currency      string
	Email         string
	Name          string
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
				PreferredCurrencyMetadataKey: params.Currency,
				AttributionIDMetadataKey:     params.AttributuonID,
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

	startOfNextMonth := getStartOfNextMonth(time.Now())

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
		BillingCycleAnchor: stripe.Int64(startOfNextMonth.Unix()),
	}

	subscription, err := c.sc.Subscriptions.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription with customer ID %s", customerID)
	}

	return subscription, err
}

func getStartOfNextMonth(t time.Time) time.Time {
	currentYear, currentMonth, _ := t.Date()

	firstOfMonth := time.Date(currentYear, currentMonth, 1, 0, 0, 0, 0, time.UTC)
	startOfNextMonth := firstOfMonth.AddDate(0, 1, 0)

	return startOfNextMonth
}

func (c *Client) SetDefaultPaymentForCustomer(ctx context.Context, customerID string, setupIntentId string) (*stripe.Customer, error) {
	if customerID == "" {
		return nil, fmt.Errorf("no customerID specified")
	}

	if setupIntentId == "" {
		return nil, fmt.Errorf("no setupIntentID specified")
	}

	setupIntent, err := c.sc.SetupIntents.Get(setupIntentId, &stripe.SetupIntentParams{
		Params: stripe.Params{
			Context: ctx,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to retrieve setup intent with id %s", setupIntentId)
	}

	paymentMethod, err := c.sc.PaymentMethods.Attach(setupIntent.PaymentMethod.ID, &stripe.PaymentMethodAttachParams{Customer: &customerID})
	if err != nil {
		return nil, fmt.Errorf("Failed to attach payment method to setup intent ID %s", setupIntentId)
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
