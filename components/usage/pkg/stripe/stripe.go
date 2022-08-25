// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/client"
)

const (
	reportIDMetadataKey = "reportId"
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
	return &Client{sc: client.New(config.SecretKey, nil)}, nil
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

type CreditSummary struct {
	Credits  int64
	ReportID string
}

// UpdateUsage updates teams' Stripe subscriptions with usage data
// `usageForTeam` is a map from team name to total workspace seconds used within a billing period.
func (c *Client) UpdateUsage(ctx context.Context, creditsPerTeam map[string]CreditSummary) error {
	teamIds := make([]string, 0, len(creditsPerTeam))
	for k := range creditsPerTeam {
		teamIds = append(teamIds, k)
	}
	queries := queriesForCustomersWithTeamIds(teamIds)

	for _, query := range queries {
		log.Infof("Searching customers in Stripe with query: %q", query)

		customers, err := c.findCustomers(ctx, query)
		if err != nil {
			return fmt.Errorf("failed to udpate usage: %w", err)
		}

		for _, customer := range customers {
			teamID := customer.Metadata["teamId"]
			log.Infof("Found customer %q for teamId %q", customer.Name, teamID)

			_, err := c.updateUsageForCustomer(ctx, customer, creditsPerTeam[teamID])
			if err != nil {
				log.WithField("customer_id", customer.ID).
					WithField("customer_name", customer.Name).
					WithField("subscriptions", customer.Subscriptions).
					WithError(err).
					Errorf("Failed to update usage.")

				reportStripeUsageUpdate(err)
				continue
			}
			reportStripeUsageUpdate(nil)
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

func (c *Client) updateUsageForCustomer(ctx context.Context, customer *stripe.Customer, summary CreditSummary) (*UsageRecord, error) {
	subscriptions := customer.Subscriptions.Data
	if len(subscriptions) != 1 {
		return nil, fmt.Errorf("customer has an unexpected number of subscriptions %v (expected 1, got %d)", subscriptions, len(subscriptions))
	}
	subscription := customer.Subscriptions.Data[0]

	log.Infof("Customer has subscription: %q", subscription.ID)
	if len(subscription.Items.Data) != 1 {
		return nil, fmt.Errorf("subscription %s has an unexpected number of subscriptionItems (expected 1, got %d)", subscription.ID, len(subscription.Items.Data))
	}

	subscriptionItemId := subscription.Items.Data[0].ID
	log.Infof("Registering usage against subscriptionItem %q", subscriptionItemId)
	_, err := c.sc.UsageRecords.New(&stripe.UsageRecordParams{
		Params: stripe.Params{
			Context: ctx,
		},
		SubscriptionItem: stripe.String(subscriptionItemId),
		Quantity:         stripe.Int64(summary.Credits),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to register usage for customer %q on subscription item %s", customer.Name, subscriptionItemId)
	}

	invoice, err := c.GetUpcomingInvoice(ctx, customer.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to find upcoming invoice for customer %s: %w", customer.ID, err)
	}

	_, err = c.UpdateInvoiceMetadata(ctx, invoice.ID, map[string]string{
		reportIDMetadataKey: summary.ReportID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to udpate invoice %s metadata with report ID: %w", invoice.ID, err)
	}

	return &UsageRecord{
		SubscriptionItemID: subscriptionItemId,
		Quantity:           summary.Credits,
	}, nil
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

// GetUpcomingInvoice fetches the upcoming invoice for the given team or user id.
func (c *Client) GetUpcomingInvoice(ctx context.Context, customerID string) (*Invoice, error) {
	invoiceParams := &stripe.InvoiceParams{
		Params: stripe.Params{
			Context: ctx,
		},
		Customer: stripe.String(customerID),
	}
	invoice, err := c.sc.Invoices.GetNext(invoiceParams)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch the upcoming invoice for customer %s", customerID)
	}
	if len(invoice.Lines.Data) < 1 {
		return nil, fmt.Errorf("no line items on invoice %s for customer %s", invoice.ID, customerID)
	}

	return &Invoice{
		ID:             invoice.ID,
		SubscriptionID: invoice.Subscription.ID,
		Amount:         invoice.AmountRemaining,
		Currency:       string(invoice.Currency),
		Credits:        invoice.Lines.Data[0].Quantity,
	}, nil
}

func (c *Client) UpdateInvoiceMetadata(ctx context.Context, invoiceID string, metadata map[string]string) (*stripe.Invoice, error) {
	invoice, err := c.sc.Invoices.Update(invoiceID, &stripe.InvoiceParams{
		Params: stripe.Params{
			Context:  ctx,
			Metadata: metadata,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update invoice %s metadata: %w", invoiceID, err)
	}

	return invoice, nil
}

// queriesForCustomersWithTeamIds constructs Stripe query strings to find the Stripe Customer for each teamId
// It returns multiple queries, each being a big disjunction of subclauses so that we can process multiple teamIds in one query.
// `clausesPerQuery` is a limit enforced by the Stripe API.
func queriesForCustomersWithTeamIds(teamIds []string) []string {
	const clausesPerQuery = 10
	var queries []string
	sb := strings.Builder{}

	for i := 0; i < len(teamIds); i += clausesPerQuery {
		sb.Reset()
		for j := 0; j < clausesPerQuery && i+j < len(teamIds); j++ {
			sb.WriteString(fmt.Sprintf("metadata['teamId']:'%s'", teamIds[i+j]))
			if j < clausesPerQuery-1 && i+j < len(teamIds)-1 {
				sb.WriteString(" OR ")
			}
		}
		queries = append(queries, sb.String())
	}

	return queries
}
