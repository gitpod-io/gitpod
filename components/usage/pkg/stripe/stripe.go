// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/customer"
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

// FindCustomersForTeamIds queries the stripe API to find all customers with a teamId in `teamIds`.
func FindCustomersForTeamIds(teamIds []string) {
	queries := queriesForCustomersWithTeamIds(teamIds)

	for _, query := range queries {
		log.Infof("about to make query %q", query)
		params := &stripe.CustomerSearchParams{SearchParams: stripe.SearchParams{Query: query}}
		iter := customer.Search(params)
		for iter.Next() {
			customer := iter.Customer()
			log.Infof("found customer %q for teamId %q", customer.Name, customer.Metadata["teamId"])
		}
	}
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
