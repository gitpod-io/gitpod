// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WorkspaceInstanceUsage struct {
	InstanceID    uuid.UUID     `gorm:"primary_key;column:instanceId;type:char;size:36;" json:"instanceId"`
	AttributionID AttributionID `gorm:"column:attributionId;type:varchar;size:255;" json:"attributionId"`

	UserID         uuid.UUID     `gorm:"column:userId;type:varchar;size:255;" json:"userId"`
	WorkspaceID    string        `gorm:"column:workspaceId;type:varchar;size:255;" json:"workspaceId"`
	ProjectID      string        `gorm:"column:projectId;type:varchar;size:255;" json:"projectId"`
	WorkspaceType  WorkspaceType `gorm:"column:workspaceType;type:varchar;size:255;" json:"workspaceType"`
	WorkspaceClass string        `gorm:"column:workspaceClass;type:varchar;size:255;" json:"workspaceClass"`

	CreditsUsed float64 `gorm:"column:creditsUsed;type:double;" json:"creditsUsed"`

	StartedAt time.Time    `gorm:"column:startedAt;type:timestamp;" json:"startedAt"`
	StoppedAt sql.NullTime `gorm:"column:stoppedAt;type:timestamp;" json:"stoppedAt"`

	GenerationID int `gorm:"column:generationId;type:int;" json:"generationId"`

	// deleted is used by db-sync
	Deleted bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (u *WorkspaceInstanceUsage) TableName() string {
	return "d_b_workspace_instance_usage"
}

func CreateUsageRecords(ctx context.Context, conn *gorm.DB, records []WorkspaceInstanceUsage) error {
	db := conn.WithContext(ctx).Clauses(clause.OnConflict{
		UpdateAll: true,
	})

	return db.CreateInBatches(records, 1000).Error
}

type order int

func (o order) ToSQL() string {
	switch o {
	case AscendingOrder:
		return "ASC"
	default:
		return "DESC"
	}
}

const (
	DescendingOrder order = iota
	AscendingOrder
)

func ListUsage(ctx context.Context, conn *gorm.DB, attributionId AttributionID, from, to time.Time, sort order) ([]WorkspaceInstanceUsage, error) {
	db := conn.WithContext(ctx)

	var usageRecords []WorkspaceInstanceUsage
	result := db.
		Order(fmt.Sprintf("startedAt %s", sort.ToSQL())).
		Where("attributionId = ?", attributionId).
		// started before, finished inside query range
		Where("? <= stoppedAt AND stoppedAt < ?", from, to).
		// started inside query range, finished inside
		Or("startedAt >= ? AND stoppedAt < ?", from, to).
		// started inside query range, finished outside
		Or("? <= startedAt AND startedAt < ?", from, to).
		// started before query range, still running
		Or("startedAt <= ? AND (stoppedAt > ? OR stoppedAt IS NULL)", from, to).
		Find(&usageRecords)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get usage records: %s", result.Error)
	}
	return usageRecords, nil
}
