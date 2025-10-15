// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/client"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type StripeCustomer struct {
	StripeCustomerID string `gorm:"column:stripeCustomerId;type:char;size:255;"`
	AttributionID    string `gorm:"column:attributionId;type:varchar;size:255;"`
}

func (StripeCustomer) TableName() string {
	return "d_b_stripe_customer"
}

func main() {
	var (
		dbDSN       = flag.String("db-dsn", "", "Database DSN (e.g., user:pass@tcp(host:port)/dbname)")
		stripeKey   = flag.String("stripe-key", "", "Stripe secret key")
		excludeOrgs = flag.String("exclude-orgs", "", "Comma-separated list of organization IDs to exclude")
		outputFile  = flag.String("output", "active-subscriptions.txt", "Output file path")
	)
	flag.Parse()

	if *dbDSN == "" {
		fmt.Fprintf(os.Stderr, "Error: --db-dsn is required\n")
		flag.Usage()
		os.Exit(1)
	}
	if *stripeKey == "" {
		fmt.Fprintf(os.Stderr, "Error: --stripe-key is required\n")
		flag.Usage()
		os.Exit(1)
	}

	// Parse excluded organization IDs
	excludedOrgs := make(map[string]bool)
	if *excludeOrgs != "" {
		for _, orgID := range strings.Split(*excludeOrgs, ",") {
			orgID = strings.TrimSpace(orgID)
			if orgID != "" {
				excludedOrgs[orgID] = true
			}
		}
		fmt.Printf("Excluding %d organization(s)\n", len(excludedOrgs))
	}

	// Connect to database
	db, err := gorm.Open(mysql.Open(*dbDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect to database: %v\n", err)
		os.Exit(1)
	}

	// Initialize Stripe client
	sc := &client.API{}
	sc.Init(*stripeKey, nil)

	// Query all Stripe customers
	var customers []StripeCustomer
	if err := db.Find(&customers).Error; err != nil {
		fmt.Fprintf(os.Stderr, "Failed to query customers: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Found %d Stripe customers in database\n", len(customers))

	// Open output file
	f, err := os.Create(*outputFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create output file: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	ctx := context.Background()
	totalSubscriptions := 0
	excludedCount := 0
	errorCount := 0

	// Process each customer
	for _, customer := range customers {
		// Parse attribution ID (format: "team:<organizationId>")
		parts := strings.Split(customer.AttributionID, ":")
		if len(parts) != 2 || parts[0] != "team" {
			continue
		}
		orgID := parts[1]

		// Check if organization should be excluded
		if excludedOrgs[orgID] {
			excludedCount++
			continue
		}

		// Fetch customer from Stripe with subscriptions expanded
		stripeCustomer, err := sc.Customers.Get(customer.StripeCustomerID, &stripe.CustomerParams{
			Params: stripe.Params{
				Context: ctx,
				Expand:  []*string{stripe.String("subscriptions")},
			},
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error fetching customer %s: %v\n", customer.StripeCustomerID, err)
			errorCount++
			continue
		}

		// Extract active subscriptions
		if stripeCustomer.Subscriptions != nil {
			for _, sub := range stripeCustomer.Subscriptions.Data {
				if sub.Status != stripe.SubscriptionStatusCanceled {
					fmt.Fprintf(f, "%s\n", sub.ID)
					totalSubscriptions++
				}
			}
		}
	}

	fmt.Printf("\nExtraction complete!\n")
	fmt.Printf("Summary:\n")
	fmt.Printf("- Total customers processed: %d\n", len(customers))
	fmt.Printf("- Excluded (by organization): %d\n", excludedCount)
	fmt.Printf("- Active subscriptions found: %d\n", totalSubscriptions)
	fmt.Printf("- Errors: %d\n", errorCount)
	fmt.Printf("- Output written to: %s\n", *outputFile)
}
