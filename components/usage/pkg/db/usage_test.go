// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
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
		EffectiveTime: db.NewVarcharTime(start.Add(-1 * 23 * time.Hour)),
		Draft:         true,
	})

	entryInside := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarcharTime(start.Add(2 * time.Minute)),
	})

	entryAfter := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarcharTime(end.Add(2 * time.Hour)),
	})

	usageEntries := []db.Usage{entryBefore, entryInside, entryAfter}
	dbtest.CreateUsageRecords(t, conn, usageEntries...)
	listResult, err := db.FindUsage(context.Background(), conn, attributionID, db.NewVarcharTime(start), db.NewVarcharTime(end), 0, 10)
	require.NoError(t, err)

	require.Equal(t, 1, len(listResult))
	require.Equal(t, []db.Usage{entryInside}, listResult)
}

func TestInsertUsageRecords(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)

	usage := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarcharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})

	dbtest.CreateUsageRecords(t, conn, usage)
	updatedDesc := "Updated Description"
	usage.Description = updatedDesc

	require.NoError(t, db.InsertUsage(context.Background(), conn, usage))

	drafts, err := db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	require.Equal(t, 1, len(drafts))
	require.NotEqual(t, updatedDesc, drafts[0].Description)
}

func TestUpdateUsageRecords(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)

	usage := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarcharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})

	dbtest.CreateUsageRecords(t, conn, usage)
	updatedDesc := "Updated Description"
	usage.Description = updatedDesc

	require.NoError(t, db.UpdateUsage(context.Background(), conn, usage))

	drafts, err := db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	require.Equal(t, 1, len(drafts))
	require.Equal(t, updatedDesc, drafts[0].Description)
}

func TestFindAllDraftUsage(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	start := time.Date(2022, 7, 1, 0, 0, 0, 0, time.UTC)

	usage1 := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarcharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})
	usage2 := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarcharTime(start.Add(2 * time.Hour)),
		Draft:         true,
	})
	usage3 := dbtest.NewUsage(t, db.Usage{
		AttributionID: attributionID,
		EffectiveTime: db.NewVarcharTime(start.Add(2 * time.Hour)),
		Draft:         false,
	})

	dbtest.CreateUsageRecords(t, conn, usage1, usage2, usage3)
	drafts, err := db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	require.Equal(t, 2, len(drafts))
	for _, usage := range drafts {
		require.True(t, usage.Draft)
	}

	// let's finalize one record
	usage2.Draft = false
	require.NoError(t, db.UpdateUsage(context.Background(), conn, usage2))

	drafts, err = db.FindAllDraftUsage(context.Background(), conn)
	require.NoError(t, err)
	require.Equal(t, 1, len(drafts))
	for _, usage := range drafts {
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
