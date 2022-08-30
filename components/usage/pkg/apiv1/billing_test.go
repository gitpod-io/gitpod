// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCreditSummaryForTeams(t *testing.T) {
	teamID_A, teamID_B := uuid.New().String(), uuid.New().String()
	teamAttributionID_A, teamAttributionID_B := db.NewTeamAttributionID(teamID_A), db.NewTeamAttributionID(teamID_B)
	reportID := "report_id_1"

	scenarios := []struct {
		Name              string
		Sessions          db.UsageReport
		BillSessionsAfter time.Time
		Expected          map[string]stripe.CreditSummary
	}{
		{
			Name:              "no instances in report, no summary",
			BillSessionsAfter: time.Time{},
			Sessions:          nil,
			Expected:          map[string]stripe.CreditSummary{},
		},
		{
			Name:              "skips user attributions",
			BillSessionsAfter: time.Time{},
			Sessions: []db.WorkspaceInstanceUsage{
				{
					AttributionID: db.NewUserAttributionID(uuid.New().String()),
				},
			},
			Expected: map[string]stripe.CreditSummary{},
		},
		{
			Name:              "two workspace instances",
			BillSessionsAfter: time.Time{},
			Sessions: []db.WorkspaceInstanceUsage{
				{
					// has 1 day and 23 hours of usage
					AttributionID: teamAttributionID_A,
					CreditsUsed:   (24 + 23) * 10,
				},
				{
					// has 1 hour of usage
					AttributionID: teamAttributionID_A,
					CreditsUsed:   10,
				},
			},
			Expected: map[string]stripe.CreditSummary{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: {
					Credits:  480,
					ReportID: reportID,
				},
			},
		},
		{
			Name:              "multiple teams",
			BillSessionsAfter: time.Time{},
			Sessions: []db.WorkspaceInstanceUsage{
				{
					// has 12 hours of usage
					AttributionID: teamAttributionID_A,
					CreditsUsed:   (12) * 10,
				},
				{
					// has 1 day of usage
					AttributionID: teamAttributionID_B,
					CreditsUsed:   (24) * 10,
				},
			},
			Expected: map[string]stripe.CreditSummary{
				// total of 2 days runtime, at 10 credits per hour, that's 480 credits
				teamID_A: {
					Credits:  120,
					ReportID: reportID,
				},
				teamID_B: {
					Credits:  240,
					ReportID: reportID,
				},
			},
		},
		{
			Name:              "two instances, same team, one of which started too early to be considered",
			BillSessionsAfter: time.Now().AddDate(0, 0, -2),
			Sessions: []db.WorkspaceInstanceUsage{
				{
					// has 12 hours of usage, started yesterday
					AttributionID: teamAttributionID_A,
					CreditsUsed:   (12) * 10,
					StartedAt:     time.Now().AddDate(0, 0, -1),
				},
				{
					// has 1 day of usage, but started three days ago
					AttributionID: teamAttributionID_A,
					CreditsUsed:   (24) * 10,
					StartedAt:     time.Now().AddDate(0, 0, -3),
				},
			},
			Expected: map[string]stripe.CreditSummary{
				teamID_A: {
					Credits:  120,
					ReportID: reportID,
				},
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			svc := NewBillingService(&stripe.Client{}, s.BillSessionsAfter, &gorm.DB{}, nil)
			actual, err := svc.creditSummaryForTeams(s.Sessions, reportID)
			require.NoError(t, err)
			require.Equal(t, s.Expected, actual)
		})
	}
}
