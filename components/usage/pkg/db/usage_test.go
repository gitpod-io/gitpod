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

func TestUpsertUsage_FailsWhenNoIDSet(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	entry := &db.Usage{
		AttributionID: db.NewUserAttributionID(uuid.New().String()),
		Description:   "",
		CreditCents:   0,
		//EffectiveTime: db.NewVarcharTime(start.Add(-1 * 23 * time.Hour)),
		Kind:     "",
		Draft:    true,
		Metadata: nil,
	}

	updated, err := db.UpsertUsage(context.Background(), conn, entry)
	require.NoError(t, err)
	require.Equal(t, entry, updated)
}

func TestUpsertUsage_FailsWhenKindIsWorkspaceInstanceButIDMissing(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	entry := &db.Usage{
		ID:            uuid.New(),
		AttributionID: db.NewUserAttributionID(uuid.New().String()),
		Description:   "some description",
		CreditCents:   -5,
		EffectiveTime: db.NewVarcharTime(time.Now()),
		Kind:          db.UsageKind_WorkspaceInstance,
		Draft:         false,
		Metadata:      nil,
	}

	_, err := db.UpsertUsage(context.Background(), conn, entry)
	require.Error(t, err)
}

func TestUpsertUsage_CreatesWhenEntryDoesNotExist(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	entry := &db.Usage{
		ID:                  uuid.New(),
		AttributionID:       db.NewUserAttributionID(uuid.New().String()),
		Description:         "some description",
		CreditCents:         -5,
		EffectiveTime:       db.NewVarcharTime(time.Now()),
		Kind:                db.UsageKind_WorkspaceInstance,
		WorkspaceInstanceID: uuid.New(),
		Draft:               false,
		Metadata:            nil,
	}

	updated, err := db.UpsertUsage(context.Background(), conn, entry)
	require.NoError(t, err)
	require.Equal(t, entry, updated)

	stored := db.Usage{}
	tx := conn.First(&stored, entry.ID)
	require.NoError(t, tx.Error)

	require.Equal(t, entry, stored)
}
