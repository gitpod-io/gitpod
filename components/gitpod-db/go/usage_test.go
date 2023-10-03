// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"

	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestFindUsageInRange(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC)

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	entryBefore := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(-1 * 23 * time.Hour)),
		Draft:         true,
	})

	entryInside := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Minute)),
	})

	entryAfter := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(end.Add(2 * time.Hour)),
	})

	usageEntries := []db.Usage{entryBefore, entryInside, entryAfter}
	dbtest.CreateUsageRecords(t, conn, usageEntries...)
	listResult, err := db.FindUsage(context.Background(), conn, &db.FindUsageParams{
		AttributionId: attributionID,
		From:          start,
		To:            end,
	})
	require.NoError(t, err)

	require.Equal(t, 1, len(listResult))
	require.Equal(t, []db.Usage{entryInside}, listResult)
}

func TestFindUsageInRangeByUser(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC)
	userID := uuid.New()

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	entryBefore := dbtest.NewUsage(t, withUserId(userID, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(-1 * 23 * time.Hour)),
		Draft:         true,
	}))

	entryInside := dbtest.NewUsage(t, withUserId(userID, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Minute)),
	}))

	entryInsideOtherUser := dbtest.NewUsage(t, withUserId(uuid.New(), db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Minute)),
	}))

	entryAfter := dbtest.NewUsage(t, withUserId(userID, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(end.Add(2 * time.Hour)),
	}))

	usageEntries := []db.Usage{entryBefore, entryInside, entryInsideOtherUser, entryAfter}
	dbtest.CreateUsageRecords(t, conn, usageEntries...)
	listResult, err := db.FindUsage(context.Background(), conn, &db.FindUsageParams{
		AttributionId: attributionID,
		UserID:        userID,
		From:          start,
		To:            end,
	})
	require.NoError(t, err)

	require.Equal(t, 1, len(listResult))
	require.Equal(t, entryInside.ID, listResult[0].ID)

	summary, err := db.GetUsageSummary(context.Background(), conn, db.GetUsageSummaryParams{
		AttributionId: attributionID,
		UserID:        userID,
		From:          start,
		To:            end,
	})
	require.NoError(t, err)
	require.Equal(t, entryInside.CreditCents, summary.CreditCentsUsed)

}

func TestGetUsageSummary(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2022, 8, 1, 0, 0, 0, 0, time.UTC)

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	draftBefore := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(-1 * 23 * time.Hour)),
		CreditCents:   100,
		Draft:         true,
	})
	nondraftBefore := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(-1 * 23 * time.Hour)),
		CreditCents:   200,
		Draft:         false,
	})

	draftInside := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		CreditCents:   300,
		Draft:         true,
	})
	nonDraftInside := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		CreditCents:   400,
		Draft:         false,
	})

	nonDraftAfter := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(end.Add(2 * time.Hour)),
		CreditCents:   1000,
	})

	invoice := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		Kind:          db.InvoiceUsageKind,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		CreditCents:   -400,
		Draft:         false,
	})

	dbtest.CreateUsageRecords(t, conn, draftBefore, nondraftBefore, draftInside, nonDraftInside, nonDraftAfter, invoice)

	tests := []struct {
		start, end    time.Time
		excludeDrafts bool
		// expectations
		creditCents     db.CreditCents
		numberOfRecords int
	}{
		{start, end, false, 700, 2},
		{start, end, true, 400, 1},
		{end, end, false, 0, 0},
		{end, end, true, 0, 0},
		{start, start, false, 0, 0},
		{start.Add(-500 * 24 * time.Hour), end, false, 1000, 4},
		{start.Add(-500 * 24 * time.Hour), end.Add(500 * 24 * time.Hour), false, 2000, 5},
	}

	for i, test := range tests {
		t.Run(fmt.Sprintf("Running test no %d", i+1), func(t *testing.T) {
			usageSummary, err := db.GetUsageSummary(context.Background(), conn, db.GetUsageSummaryParams{
				AttributionId: attributionID,
				From:          test.start,
				To:            test.end,
				ExcludeDrafts: test.excludeDrafts,
			})
			require.NoError(t, err)

			require.EqualValues(t, test.creditCents, usageSummary.CreditCentsUsed)
			require.EqualValues(t, test.numberOfRecords, usageSummary.NumberOfRecords)
		})
	}
}

func TestInsertUsageRecords(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)

	usage := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})

	dbtest.CreateUsageRecords(t, conn, usage)
	updatedDesc := "Updated Description"
	usage.Description = updatedDesc

	require.NoError(t, db.InsertUsage(context.Background(), conn, usage))

	drafts, err := db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	cleaned := filter(drafts, attributionID)
	require.Equal(t, 1, len(cleaned))
	require.NotEqual(t, updatedDesc, cleaned[0].Description)
}

func filter(drafts []db.Usage, attributionID db.AttributionID) []db.Usage {
	var cleaned []db.Usage
	for _, draft := range drafts {
		if draft.AttributionID == attributionID {
			cleaned = append(cleaned, draft)
		}
	}
	return cleaned
}

func TestUpdateUsageRecords(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)

	usage := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})

	dbtest.CreateUsageRecords(t, conn, usage)
	updatedDesc := "Updated Description"
	usage.Description = updatedDesc

	require.NoError(t, db.UpdateUsage(context.Background(), conn, usage))

	drafts, err := db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	cleaned := filter(drafts, attributionID)
	require.Equal(t, 1, len(cleaned))
	require.Equal(t, updatedDesc, cleaned[0].Description)
}

func TestFindAllDraftUsage(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)

	usage1 := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})
	usage2 := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})
	usage3 := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarCharTime(start.Add(2 * time.Hour)),
		Draft:         false,
	})

	dbtest.CreateUsageRecords(t, conn, usage1, usage2, usage3)
	drafts, err := db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	cleaned := filter(drafts, attributionID)
	require.Equal(t, 2, len(cleaned))
	for _, usage := range cleaned {
		require.True(t, usage.Draft)
	}

	// let's finalize one record
	usage2.Draft = false
	require.NoError(t, db.UpdateUsage(context.Background(), conn, usage2))

	drafts, err = db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	cleaned = filter(drafts, attributionID)
	require.Equal(t, 1, len(cleaned))
	for _, usage := range cleaned {
		require.True(t, usage.Draft)
	}
}

func TestCreditCents(t *testing.T) {
	for _, s := range []struct {
		value           float64
		expected        db.CreditCents
		expectedAsFloat float64
	}{
		{
			value:           0,
			expected:        0,
			expectedAsFloat: 0,
		},
		{
			value:           0.1,
			expected:        10,
			expectedAsFloat: 0.1,
		},
		{
			value:           1.1111,
			expected:        111,
			expectedAsFloat: 1.11,
		},
		{
			value:           1.4999,
			expected:        150,
			expectedAsFloat: 1.50,
		},
		{
			value:           1.500,
			expected:        150,
			expectedAsFloat: 1.50,
		},
		{
			value:           1.501,
			expected:        150,
			expectedAsFloat: 1.50,
		},
		{
			value:           1.50999,
			expected:        151,
			expectedAsFloat: 1.51,
		},
		{
			value:           1.9999,
			expected:        200,
			expectedAsFloat: 2.00,
		},
		{
			value:           -1.9999,
			expected:        -200,
			expectedAsFloat: -2.00,
		},
	} {
		cc := db.NewCreditCents(s.value)
		require.Equal(t, s.expected, cc)
		require.Equal(t, s.expectedAsFloat, cc.ToCredits())
	}
}

func TestListBalance(t *testing.T) {
	teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
	teamAttributionID2 := db.NewTeamAttributionID(uuid.New().String())

	conn := dbtest.ConnectForTests(t)
	dbtest.CreateUsageRecords(t, conn,
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID,
			CreditCents:   100,
		}),
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID,
			CreditCents:   900,
		}),
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID2,
			CreditCents:   450,
		}),
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID2,
			CreditCents:   -500,
			Kind:          db.InvoiceUsageKind,
		}),
	)

	balances, err := db.ListBalance(context.Background(), conn)
	require.NoError(t, err)
	require.Contains(t, balances, db.Balance{
		AttributionID: teamAttributionID,
		CreditCents:   1000,
	})
	require.Contains(t, balances, db.Balance{
		AttributionID: teamAttributionID2,
		CreditCents:   -50,
	})
}

func withUserId(id uuid.UUID, usage db.Usage) db.Usage {
	usage.SetCreditNoteMetaData(db.CreditNoteMetaData{
		UserID: id.String(),
	})
	return usage
}

func TestGetBalance(t *testing.T) {
	teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
	teamAttributionID2 := db.NewTeamAttributionID(uuid.New().String())
	noUsageAttributionID := db.NewTeamAttributionID(uuid.New().String())

	conn := dbtest.ConnectForTests(t)
	dbtest.CreateUsageRecords(t, conn,
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID,
			CreditCents:   100,
		}),
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID,
			CreditCents:   900,
		}),
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID2,
			CreditCents:   450,
		}),
		dbtest.NewUsage(t, db.Usage{
			AttributionID: teamAttributionID2,
			CreditCents:   -500,
			Kind:          db.InvoiceUsageKind,
		}),
	)

	teamBalance, err := db.GetBalance(context.Background(), conn, teamAttributionID)
	require.NoError(t, err)
	require.EqualValues(t, 1000, int(teamBalance))

	userBalance, err := db.GetBalance(context.Background(), conn, teamAttributionID2)
	require.NoError(t, err)
	require.EqualValues(t, -50, int(userBalance))

	noUsageBalance, err := db.GetBalance(context.Background(), conn, noUsageAttributionID)
	require.NoError(t, err)
	require.EqualValues(t, 0, int(noUsageBalance))
}
