// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/client"
)

func main() {
	var (
		stripeKey  = flag.String("stripe-key", "", "Stripe secret key")
		inputFile  = flag.String("input", "active-subscriptions.txt", "Input file with subscription IDs")
		dryRun     = flag.Bool("dry-run", false, "Perform dry run without making changes")
	)
	flag.Parse()

	if *stripeKey == "" {
		fmt.Fprintf(os.Stderr, "Error: --stripe-key is required\n")
		flag.Usage()
		os.Exit(1)
	}

	// Initialize Stripe client
	sc := &client.API{}
	sc.Init(*stripeKey, nil)

	// Read subscription IDs from file
	subscriptionIDs, err := readSubscriptionIDs(*inputFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to read input file: %v\n", err)
		os.Exit(1)
	}

	if len(subscriptionIDs) == 0 {
		fmt.Println("No subscription IDs found in input file")
		os.Exit(0)
	}

	if *dryRun {
		fmt.Printf("=== DRY RUN MODE ===\n")
	}
	fmt.Printf("Processing %d subscription(s)...\n\n", len(subscriptionIDs))

	ctx := context.Background()
	var (
		cancelled       = 0
		alreadyCanceled = 0
		errors          = 0
	)

	// Process each subscription
	for i, subID := range subscriptionIDs {
		subID = strings.TrimSpace(subID)
		if subID == "" {
			continue
		}

		fmt.Printf("[%d/%d] Processing %s... ", i+1, len(subscriptionIDs), subID)

		// Retrieve subscription with latest invoice expanded
		sub, err := sc.Subscriptions.Get(subID, &stripe.SubscriptionParams{
			Params: stripe.Params{
				Context: ctx,
				Expand:  []*string{stripe.String("latest_invoice")},
			},
		})
		if err != nil {
			fmt.Printf("ERROR: %v\n", err)
			errors++
			continue
		}

		// Check if already canceled
		if sub.Status == stripe.SubscriptionStatusCanceled {
			alreadyCanceled++
			fmt.Printf("already canceled (skipped)\n")
			continue
		}

		// Finalize draft invoice if exists
		if sub.LatestInvoice != nil && sub.LatestInvoice.Status == stripe.InvoiceStatusDraft {
			invoiceID := sub.LatestInvoice.ID
			if *dryRun {
				fmt.Printf("would finalize invoice %s, ", invoiceID)
			} else {
				_, err := sc.Invoices.FinalizeInvoice(invoiceID, &stripe.InvoiceFinalizeParams{
					Params: stripe.Params{
						Context: ctx,
					},
				})
				if err != nil {
					fmt.Printf("ERROR finalizing invoice %s: %v\n", invoiceID, err)
					errors++
					continue
				}
				fmt.Printf("finalized invoice %s, ", invoiceID)
			}
		}

		// Cancel subscription
		if *dryRun {
			fmt.Printf("would cancel subscription\n")
			cancelled++
		} else {
			_, err := sc.Subscriptions.Cancel(subID, &stripe.SubscriptionCancelParams{
				Params: stripe.Params{
					Context: ctx,
				},
			})
			if err != nil {
				fmt.Printf("ERROR canceling: %v\n", err)
				errors++
				continue
			}
			fmt.Printf("canceled\n")
			cancelled++
		}
	}

	// Print summary
	fmt.Printf("\n")
	if *dryRun {
		fmt.Printf("=== DRY RUN SUMMARY ===\n")
	} else {
		fmt.Printf("=== SUMMARY ===\n")
	}
	fmt.Printf("Total processed: %d\n", len(subscriptionIDs))
	fmt.Printf("Cancelled: %d\n", cancelled)
	fmt.Printf("Already cancelled (skipped): %d\n", alreadyCanceled)
	fmt.Printf("Errors: %d\n", errors)
}

func readSubscriptionIDs(filename string) ([]string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var ids []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			ids = append(ids, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return ids, nil
}
