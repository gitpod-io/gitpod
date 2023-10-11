// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
)

type Config struct {
	// LedgerSchedule determines how frequently to run the Usage/Billing controller.
	// When LedgerSchedule is empty, the background controller is disabled.
	LedgerSchedule string `json:"controllerSchedule,omitempty"`

	// ResetUsageSchedule determines how frequently to run the Usage Reset job.
	// When empty, the job is disabled.
	ResetUsageSchedule string `json:"resetUsageSchedule,omitempty"`

	CreditsPerMinuteByWorkspaceClass map[string]float64 `json:"creditsPerMinuteByWorkspaceClass,omitempty"`

	StripeCredentialsFile string `json:"stripeCredentialsFile,omitempty"`

	DefaultSpendingLimit db.DefaultSpendingLimit `json:"defaultSpendingLimit"`

	// StripePrices configure which Stripe Price IDs should be used
	StripePrices StripePrices `json:"stripePrices"`
}

type StripePrices struct {
	IndividualUsagePriceIDs PriceConfig `json:"individualUsagePriceIds"`
	TeamUsagePriceIDs       PriceConfig `json:"teamUsagePriceIds"`
}

type PriceConfig struct {
	EUR string `json:"eur"`
	USD string `json:"usd"`
}
