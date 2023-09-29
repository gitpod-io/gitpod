// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"context"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func NewUsage(t *testing.T, record db.Usage) db.Usage {
	t.Helper()

	workspaceInstanceId := uuid.New()

	result := db.Usage{
		ID:            uuid.New(),
		AttributionID: db.NewTeamAttributionID(uuid.New().String()),
		Description:   "some description",
		CreditCents:   42,
		EffectiveTime: db.VarcharTime{},
		Kind:          db.WorkspaceInstanceUsageKind,
		ObjectID:      workspaceInstanceId.String(),
	}

	if record.ID.ID() != 0 {
		result.ID = record.ID
	}
	if record.EffectiveTime.IsSet() {
		result.EffectiveTime = record.EffectiveTime
	}
	if record.AttributionID != "" {
		result.AttributionID = record.AttributionID
	}
	if record.Description != "" {
		result.Description = record.Description
	}
	if record.CreditCents != 0 {
		result.CreditCents = record.CreditCents
	}
	if record.ObjectID != "" {
		result.ObjectID = record.ObjectID
	}
	if record.Kind != "" {
		result.Kind = record.Kind
	}
	if record.Draft {
		result.Draft = true
	}
	if record.Metadata != nil {
		result.Metadata = record.Metadata
	}
	return result
}

func CreateUsageRecords(t *testing.T, conn *gorm.DB, entries ...db.Usage) []db.Usage {
	t.Helper()

	var records []db.Usage
	var ids []string
	for _, usageEntry := range entries {
		record := NewUsage(t, usageEntry)
		records = append(records, record)
		ids = append(ids, record.ID.String())
	}

	require.NoError(t, db.InsertUsage(context.Background(), conn, entries...))
	t.Cleanup(func() {
		if len(ids) > 0 {
			require.NoError(t, conn.Where(ids).Delete(&db.Usage{}).Error)
		}
	})

	return records
}
