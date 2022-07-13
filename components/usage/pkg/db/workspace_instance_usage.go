// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WorkspaceInstanceUsage struct {
	WorkspaceID   uuid.UUID     `gorm:"primary_key;column:workspaceId;type:char;size:36;" json:"workspaceId"`
	AttributionID AttributionID `gorm:"column:attributionId;type:varchar;size:255;" json:"attributionId"`
	StartedAt     time.Time     `gorm:"column:startedAt;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"startedAt"`
	StoppedAt     sql.NullTime  `gorm:"column:stoppedAt;type:timestamp;" json:"stoppedAt"`
	CreditsUsed   float64       `gorm:"column:creditsUsed;type:double;" json:"creditsUsed"`
	GenerationId  int           `gorm:"column:generationId;type:int;" json:"generationId"`
	Deleted       bool          `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (u *WorkspaceInstanceUsage) TableName() string {
	return "d_b_workspace_instance_usage"
}

func CreateUsageRecords(ctx context.Context, conn *gorm.DB, records []WorkspaceInstanceUsage) error {
	db := conn.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "workspaceId"}},
		UpdateAll: true,
	})

	return db.CreateInBatches(records, 1000).Error
}
