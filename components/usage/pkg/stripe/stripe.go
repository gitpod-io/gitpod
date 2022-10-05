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
	AttributionIDMetadataKey = "attributionId"
)

type Client struct {
	sc *client.API
}

type ClientConfig struct {
	PublishableKey string `json:"publishableKey"`
	SecretKey      string `json:"secretKey"`
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
	sc := &client.API{}

	sc.Init(config.SecretKey, stripe.NewBackends(&http.Client{
		Transport: StripeClientMetricsRoundTripper(http.DefaultTransport),
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

func (c *Client) findCustomers(ctx context.Context, query string) ([]*stripe.Customer, error) {
	params := &stripe.CustomerSearchParams{
		SearchParams: stripe.SearchParams{
			Query:   query,
			Expand:  []*string{stripe.String("data.subscriptions")},
			Context: ctx,
		},
	}
	iter := c.sc.Customers.Search(params)
	if iter.Err() != nil {
		return nil, fmt.Errorf("failed to search for customers: %w", iter.Err())
	}

	var customers []*stripe.Customer
	for iter.Next() {
		customers = append(customers, iter.Customer())
	}

	return customers, nil
}

func (c *Client) updateUsageForCustomer(ctx context.Context, customer *stripe.Customer, credits int64) error {
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
	_, err := c.sc.UsageRecords.New(&stripe.UsageRecordParams{
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

func (c *Client) GetCustomerByTeamID(ctx context.Context, teamID string) (*stripe.Customer, error) {
	customers, err := c.findCustomers(ctx, fmt.Sprintf("metadata['teamId']:'%s'", teamID))
	if err != nil {
		return nil, fmt.Errorf("failed to find customers: %w", err)
	}

	if len(customers) == 0 {
		return nil, fmt.Errorf("no team customer found for id: %s", teamID)
	}
	if len(customers) > 1 {
		return nil, fmt.Errorf("found multiple team customers for id: %s", teamID)
	}

	return customers[0], nil
}

func (c *Client) GetCustomerByUserID(ctx context.Context, userID string) (*stripe.Customer, error) {
	customers, err := c.findCustomers(ctx, fmt.Sprintf("metadata['userId']:'%s'", userID))
	if err != nil {
		return nil, fmt.Errorf("failed to find customers: %w", err)
	}

	if len(customers) == 0 {
		return nil, fmt.Errorf("no user customer found for id: %s", userID)
	}
	if len(customers) > 1 {
		return nil, fmt.Errorf("found multiple user customers for id: %s", userID)
	}

	return customers[0], nil
}

func (c *Client) GetInvoiceWithCustomer(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
	if invoiceID == "" {
		return nil, fmt.Errorf("no invoice ID specified")
	}

	invoice, err := c.sc.Invoices.Get(invoiceID, &stripe.InvoiceParams{
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

func (c *Client) GetSubscriptionWithCustomer(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
	if subscriptionID == "" {
		return nil, fmt.Errorf("no subscriptionID specified")
	}

	subscription, err := c.sc.Subscriptions.Get(subscriptionID, &stripe.SubscriptionParams{
		Params: stripe.Params{
			Expand: []*string{stripe.String("customer")},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription %s: %w", subscriptionID, err)
	}
	return subscription, nil
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
