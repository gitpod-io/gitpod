// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"gorm.io/gorm/clause"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	UsageKind_WorkspaceInstance UsageKind = "workspace_instance"
	UsageKind_Invoice                     = "invoice"
)

type UsageKind string

type Usage struct {
	ID                  uuid.UUID      `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	AttributionID       AttributionID  `gorm:"column:attributionId;type:varchar;size:255;" json:"attributionId"`
	Description         string         `gorm:"column:description;type:varchar;size:255;" json:"description"`
	CreditCents         int64          `gorm:"column:creditCents;type:bigint;" json:"creditCents"`
	EffectiveTime       VarcharTime    `gorm:"column:effectiveTime;type:varchar;size:255;" json:"effectiveTime"`
	Kind                UsageKind      `gorm:"column:kind;type:char;size:10;" json:"kind"`
	WorkspaceInstanceID uuid.UUID      `gorm:"column:workspaceInstanceId;type:char;size:36;" json:"workspaceInstanceId"`
	Draft               bool           `gorm:"column:draft;type:boolean;" json:"draft"`
	Metadata            datatypes.JSON `gorm:"column:metadata;type:text;size:65535" json:"metadata"`
}

type FindUsageResult struct {
	UsageEntries []Usage
}

// TableName sets the insert table name for this struct type
func (u *Usage) TableName() string {
	return "d_b_usage"
}

func FindUsage(ctx context.Context, conn *gorm.DB, attributionId AttributionID, from, to VarcharTime, offset int64, limit int64) ([]Usage, error) {
	db := conn.WithContext(ctx)

	var usageRecords []Usage
	result := db.
		WithContext(ctx).
		Where("attributionId = ?", attributionId).
		Where("? <= effectiveTime AND effectiveTime < ?", from.String(), to.String()).
		Order("effectiveTime DESC").
		Offset(int(offset)).
		Limit(int(limit)).
		Find(&usageRecords)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get usage records: %s", result.Error)
	}
	return usageRecords, nil
}

func UpsertUsage(ctx context.Context, conn *gorm.DB, usage *Usage) (*Usage, error) {
	if usage.ID.ID() == 0 {
		return nil, errors.New("usage record ID not set, required")
	}

	switch usage.Kind {
	case UsageKind_WorkspaceInstance:
		// ensure there is a workspace instance ID
		if usage.WorkspaceInstanceID.ID() == 0 {
			return nil, errors.New(fmt.Sprintf("Usage record is of %s kind, but does not have a workspace instance ID set", UsageKind_WorkspaceInstance))
		}
	default:
		return nil, errors.New(fmt.Sprintf("unknown usage kind: %s", usage.Kind))
	}

	db := conn.WithContext(ctx).Clauses(clause.OnConflict{
		UpdateAll: true,
	})

	tx := db.Create(usage)
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to upsert usage record: %w", tx.Error)
	}

	return usage, nil
}
