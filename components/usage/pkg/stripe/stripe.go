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

// UpdateUsage updates teams' Stripe subscriptions with usage data
// `usageForTeam` is a map from team name to total workspace seconds used within a billing period.
func (c *Client) UpdateUsage(ctx context.Context, creditsPerTeam map[string]int64) error {
	teamIds := make([]string, 0, len(creditsPerTeam))
	for k := range creditsPerTeam {
		teamIds = append(teamIds, k)
	}
	queries := queriesForCustomersWithTeamIds(teamIds)

	for _, query := range queries {
		log.Infof("Searching customers in Stripe with query: %q", query)
		params := &stripe.CustomerSearchParams{
			SearchParams: stripe.SearchParams{
				Query:   query,
				Expand:  []*string{stripe.String("data.subscriptions")},
				Context: ctx,
			},
		}
		iter := c.sc.Customers.Search(params)
		for iter.Next() {
			customer := iter.Customer()
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

func (c *Client) updateUsageForCustomer(ctx context.Context, customer *stripe.Customer, credits int64) (*UsageRecord, error) {
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
		Quantity:         stripe.Int64(credits),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to register usage for customer %q on subscription item %s", customer.Name, subscriptionItemId)
	}

	return &UsageRecord{
		SubscriptionItemID: subscriptionItemId,
		Quantity:           credits,
	}, nil
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
