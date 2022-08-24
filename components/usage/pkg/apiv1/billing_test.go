// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"testing"
	"time"

	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

func TestCreditSummaryForTeams(t *testing.T) {
	teamID_A, teamID_B := uuid.New().String(), uuid.New().String()
	teamAttributionID_A, teamAttributionID_B := db.NewTeamAttributionID(teamID_A), db.NewTeamAttributionID(teamID_B)

	scenarios := []struct {
		Name              string
		Sessions          []*v1.BilledSession
		BillSessionsAfter time.Time
		Expected          map[string]int64
	}{
		{
			Name:              "no instances in report, no summary",
			BillSessionsAfter: time.Time{},
			Sessions:          []*v1.BilledSession{},
			Expected:          map[string]int64{},
		},
		{
			Name:              "skips user attributions",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					AttributionId: string(db.NewUserAttributionID(uuid.New().String())),
				},
			},
			Expected: map[string]int64{},
		},
		{
			Name:              "two workspace instances",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					// has 1 day and 23 hours of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       (24 + 23) * 10,
				},
				{
					// has 1 hour of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       10,
				},
			},
			Expected: map[string]int64{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: 480,
			},
		},
		{
			Name:              "multiple teams",
			BillSessionsAfter: time.Time{},
			Sessions: []*v1.BilledSession{
				{
					// has 12 hours of usage
					AttributionId: string(teamAttributionID_A),
					Credits:       (12) * 10,
				},
				{
					// has 1 day of usage
					AttributionId: string(teamAttributionID_B),
					Credits:       (24) * 10,
				},
			},
			Expected: map[string]int64{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: 120,
				teamID_B: 240,
			},
		},
		{
			Name:              "two instances, same team, one of which started too early to be considered",
			BillSessionsAfter: time.Now().AddDate(0, 0, -2),
			Sessions: []*v1.BilledSession{
				{
					// has 12 hours of usage, started yesterday
					AttributionId: string(teamAttributionID_A),
					Credits:       (12) * 10,
					StartTime:     timestamppb.New(time.Now().AddDate(0, 0, -1)),
				},
				{
					// has 1 day of usage, but started three days ago
					AttributionId: string(teamAttributionID_A),
					Credits:       (24) * 10,
					StartTime:     timestamppb.New(time.Now().AddDate(0, 0, -3)),
				},
			},
			Expected: map[string]int64{
				teamID_A: 120,
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			svc := NewBillingService(&stripe.Client{}, s.BillSessionsAfter, &gorm.DB{})
			actual, err := svc.creditSummaryForTeams(s.Sessions)
			require.NoError(t, err)
			require.Equal(t, s.Expected, actual)
		})
	}
}

func TestFinalizeInvoice(t *testing.T) {
	b := BillingService{}

	_, err := b.FinalizeInvoice(context.Background(), &v1.FinalizeInvoiceRequest{})

	require.NoError(t, err)
}

func TestCapUsageToSpendingLimit(t *testing.T) {
	type ReportSummary struct {
		// These are the inputs
		CalculatedUsage int32
		SpendingLimit   int32
		// These are the outputs (also depending on the previous run)
		EffectiveSpendingLimit int32
		CappedUsage            int32
	}

	cap := func(v, limit int32) int32 {
		if v > limit {
			return limit
		}
		return v
	}

	max := func(a, b int32) int32 {
		if a >= b {
			return a
		} else {
			return b
		}
	}

	min := func(a, b int32) int32 {
		if a <= b {
			return a
		} else {
			return b
		}
	}

	/**
	 * Takes two ReportSummaries, both from the _same invoice_ (!).
	 */
	capUsage := func(previous, current ReportSummary) (cappedUsage int32, effectiveLimit int32) {
		// idea: if a user reduces spending limit during a billing cycle, we should:
		//  - allow to reduce that threshold
		//  - but not below what we currently plan to bill them
		// This allows us to a) fix reported usage and b) avoids the exploit case.
		lowerBoundEffectiveSpendingLimit := min(previous.EffectiveSpendingLimit, current.CalculatedUsage)
		effectiveLimit = max(current.SpendingLimit, lowerBoundEffectiveSpendingLimit)
		cappedUsage = cap(current.CalculatedUsage, effectiveLimit)
		return cappedUsage, effectiveLimit
	}

	type Test struct {
		Name    string
		Reports []ReportSummary
	}

	tests := []Test{
		{
			Name: "simple test",
			Reports: []ReportSummary{{
				CalculatedUsage:        95,
				SpendingLimit:          100,
				EffectiveSpendingLimit: 100,
				CappedUsage:            100,
			},
				{
					CalculatedUsage:        105,
					SpendingLimit:          100,
					EffectiveSpendingLimit: 100,
					CappedUsage:            100,
				},
			},
		},
		{
			Name: "reduced usage, reduced spending limit",
			Reports: []ReportSummary{{
				CalculatedUsage:        105,
				SpendingLimit:          100,
				EffectiveSpendingLimit: 100,
				CappedUsage:            100,
			},
				{
					CalculatedUsage:        80, // updated usage due to corrections
					SpendingLimit:          90,
					EffectiveSpendingLimit: 90,
					CappedUsage:            80,
				},
			},
		},
		{
			Name: "reduced spending limit (exploit case: reduce spending limit shortly before you're invoiced)",
			Reports: []ReportSummary{{
				CalculatedUsage:        105,
				SpendingLimit:          100,
				EffectiveSpendingLimit: 100,
				CappedUsage:            100,
			},
				{
					CalculatedUsage:        120,
					SpendingLimit:          70, // user suddenly reduces spending limit
					EffectiveSpendingLimit: 100,
					CappedUsage:            100,
				},
				{
					CalculatedUsage:        125, // still some more usage
					SpendingLimit:          70,
					EffectiveSpendingLimit: 100,
					CappedUsage:            100,
				},
				{
					CalculatedUsage:        83, // we adjust usage calculation
					SpendingLimit:          70,
					EffectiveSpendingLimit: 83,
					CappedUsage:            83,
				},
			},
		},
		{
			Name: "reduced usage, reduced spending limit II",
			Reports: []ReportSummary{
				{
					CalculatedUsage:        106,
					SpendingLimit:          100,
					EffectiveSpendingLimit: 100,
					CappedUsage:            100,
				},
				{
					CalculatedUsage:        104, // updated usage due to corrections
					SpendingLimit:          1,
					EffectiveSpendingLimit: 100,
					CappedUsage:            100,
				},
			},
		},
		{
			Name: "Milans example",
			Reports: []ReportSummary{
				// 1.User has spending limit 25 (usage: just below at 24)
				{
					CalculatedUsage:        24,
					SpendingLimit:          25,
					EffectiveSpendingLimit: 25,
					CappedUsage:            24,
				},
				// 2. User reaches spending limit and cannot start a new workspace - they use up 26 units
				{
					CalculatedUsage:        26,
					SpendingLimit:          25,
					EffectiveSpendingLimit: 25,
					CappedUsage:            25,
				},
				// 3. + 4. + 5.: User cancelled (+ re-subscribes) before instances from previous subscription are marked as billed for (invoice finalization)
				{
					CalculatedUsage:        26,
					SpendingLimit:          25,
					EffectiveSpendingLimit: 25,
					CappedUsage:            25,
				},
				// 8. + 9.: On next run, we exclude instances from the previous run and identify the user has used up 1 credit. We CAN update the invoice to 1, despite the fact it already had been at 25.
				{
					CalculatedUsage:        1,
					SpendingLimit:          25,
					EffectiveSpendingLimit: 25,
					CappedUsage:            1,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {

			for i, current := range test.Reports {
				if i < 1 {
					continue
				}
				previous := test.Reports[i-1]

				// validate test data
				testDataCappedUsage := cap(current.CalculatedUsage, current.EffectiveSpendingLimit)
				require.Equal(t, testDataCappedUsage, current.CappedUsage, "Bad test data: cappedUsage %d inconsistent, expected %d!", current.CappedUsage, testDataCappedUsage)

				actualCappedUsage, actualEffectiveSpendingLimit := capUsage(previous, current)
				require.Equal(t, current.CappedUsage, actualCappedUsage, "Expected CappedUsage to be %d, but was %d", current.CappedUsage, actualCappedUsage)
				require.Equal(t, current.EffectiveSpendingLimit, actualEffectiveSpendingLimit, "Expected EffectiveSpendingLimit to be %d, but was %d", current.EffectiveSpendingLimit, actualEffectiveSpendingLimit)

			}
		})
	}
}
