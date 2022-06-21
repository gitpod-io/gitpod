// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/customer"
	"github.com/stripe/stripe-go/v72/usagerecord"
)

type stripeKeys struct {
	PublishableKey string `json:"publishableKey"`
	SecretKey      string `json:"secretKey"`
}

// Authenticate authenticates the Stripe client using a provided file containing a Stripe secret key.
func Authenticate(apiKeyFile string) error {
	bytes, err := os.ReadFile(apiKeyFile)
	if err != nil {
		return err
	}

	var stripeKeys stripeKeys
	err = json.Unmarshal(bytes, &stripeKeys)
	if err != nil {
		return err
	}

	stripe.Key = stripeKeys.SecretKey
	return nil
}

// UpdateUsage updates teams' Stripe subscriptions with usage data
// `usageForTeam` is a map from team name to total workspace seconds used within a billing period.
func UpdateUsage(usageForTeam map[string]int64) error {
	teamIds := make([]string, 0, len(usageForTeam))
	for k := range usageForTeam {
		teamIds = append(teamIds, k)
	}
	queries := queriesForCustomersWithTeamIds(teamIds)

	for _, query := range queries {
		log.Infof("about to make query %q", query)
		params := &stripe.CustomerSearchParams{
			SearchParams: stripe.SearchParams{
				Query:  query,
				Expand: []*string{stripe.String("data.subscriptions")},
			},
		}
		iter := customer.Search(params)
		for iter.Next() {
			customer := iter.Customer()
			log.Infof("found customer %q for teamId %q", customer.Name, customer.Metadata["teamId"])
			subscriptions := customer.Subscriptions.Data
			if len(subscriptions) != 1 {
				log.Errorf("customer has an unexpected number of subscriptions (expected 1, got %d)", len(subscriptions))
				continue
			}
			subscription := customer.Subscriptions.Data[0]

			log.Infof("customer has subscription: %q", subscription.ID)
			if len(subscription.Items.Data) != 1 {
				log.Errorf("this subscription has an unexpected number of subscriptionItems (expected 1, got %d)", len(subscription.Items.Data))
				continue
			}

			creditsUsed := workspaceSecondsToCredits(usageForTeam[customer.Metadata["teamId"]])

			subscriptionItemId := subscription.Items.Data[0].ID
			log.Infof("registering usage against subscriptionItem %q", subscriptionItemId)
			_, err := usagerecord.New(&stripe.UsageRecordParams{
				SubscriptionItem: stripe.String(subscriptionItemId),
				Quantity:         stripe.Int64(creditsUsed),
			})
			if err != nil {
				log.WithError(err).Errorf("failed to register usage for customer %q", customer.Name)
			}
		}
	}
	return nil
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

// workspaceSecondsToCredits converts seconds (of workspace usage) into Stripe credits.
// (1 credit = 6 minutes, rounded up)
func workspaceSecondsToCredits(seconds int64) int64 {
	return int64(math.Ceil(float64(seconds) / (60 * 6)))
}
