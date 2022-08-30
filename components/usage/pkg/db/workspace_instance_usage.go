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

type ListUsageResult struct {
	UsageRecords     []WorkspaceInstanceUsage
	Count            int64
	TotalCreditsUsed float64
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

type Order int

func (o Order) ToSQL() string {
	switch o {
	case AscendingOrder:
		return "ASC"
	default:
		return "DESC"
	}
}

const (
	DescendingOrder Order = iota
	AscendingOrder
)

func ListUsage(ctx context.Context, conn *gorm.DB, attributionId AttributionID, from, to time.Time, sort Order, offset int64, limit int64) (*ListUsageResult, error) {
	var listUsageResult = new(ListUsageResult)
	db := conn.WithContext(ctx)

	var totalCreditsUsed sql.NullFloat64
	var count sql.NullInt64
	countResult, err := db.
		WithContext(ctx).
		Table((&WorkspaceInstanceUsage{}).TableName()).
		Select("sum(creditsUsed) as totalCreditsUsed", "count(*) as count").
		Order(fmt.Sprintf("startedAt %s", sort.ToSQL())).
		Where("attributionId = ?", attributionId).
		Where(
			// started before, finished inside query range
			conn.Where("? <= stoppedAt AND stoppedAt < ?", from, to).
				// started inside query range, finished inside
				Or("startedAt >= ? AND stoppedAt < ?", from, to).
				// started inside query range, finished outside
				Or("? <= startedAt AND startedAt < ?", from, to).
				// started before query range, still running
				Or("startedAt <= ? AND (stoppedAt > ? OR stoppedAt IS NULL)", from, to),
		).
		Rows()
	if err != nil || !countResult.Next() {
		return nil, fmt.Errorf("failed to get count of usage records: %s", err)
	}
	err = countResult.Scan(&totalCreditsUsed, &count)
	if err != nil {
		return nil, fmt.Errorf("failed to get count of usage records: %s", err)
	}
	if totalCreditsUsed.Valid {
		listUsageResult.TotalCreditsUsed = totalCreditsUsed.Float64
	}
	if count.Valid {
		listUsageResult.Count = count.Int64
	}

	var usageRecords []WorkspaceInstanceUsage
	result := db.
		WithContext(ctx).
		Table((&WorkspaceInstanceUsage{}).TableName()).
		Order(fmt.Sprintf("startedAt %s", sort.ToSQL())).
		Where("attributionId = ?", attributionId).
		Where(
			// started before, finished inside query range
			conn.Where("? <= stoppedAt AND stoppedAt < ?", from, to).
				// started inside query range, finished inside
				Or("startedAt >= ? AND stoppedAt < ?", from, to).
				// started inside query range, finished outside
				Or("? <= startedAt AND startedAt < ?", from, to).
				// started before query range, still running
				Or("startedAt <= ? AND (stoppedAt > ? OR stoppedAt IS NULL)", from, to),
		).
		Offset(int(offset)).
		Limit(int(limit)).
		Find(&usageRecords)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get usage records: %s", result.Error)
	}
	listUsageResult.UsageRecords = usageRecords

	return listUsageResult, nil
}

type UsageReport []WorkspaceInstanceUsage
