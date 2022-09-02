// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbtest

import (
	"testing"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func NewUsage(t *testing.T, record db.Usage) db.Usage {
	t.Helper()

	result := db.Usage{
		ID:                  uuid.New(),
		AttributionID:       db.NewUserAttributionID(uuid.New().String()),
		Description:         "some description",
		CreditCents:         42,
		EffectiveTime:       db.VarcharTime{},
		Kind:                "workspaceinstance",
		WorkspaceInstanceID: uuid.New(),
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
	if record.WorkspaceInstanceID.ID() != 0 {
		result.WorkspaceInstanceID = record.WorkspaceInstanceID
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

	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		require.NoError(t, conn.Where(ids).Delete(&db.Usage{}).Error)
	})

	t.Logf("stored %d", len(entries))

	return records
}
