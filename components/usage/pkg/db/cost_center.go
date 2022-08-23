// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

var CostCenterNotFound = errors.New("CostCenter not found")

type CostCenter struct {
	ID            AttributionID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	SpendingLimit int32         `gorm:"column:spendingLimit;type:int;default:0;" json:"spendingLimit"`
	LastModified  time.Time     `gorm:"->:column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	// deleted is restricted for use by db-sync
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *CostCenter) TableName() string {
	return "d_b_cost_center"
}

func GetCostCenter(ctx context.Context, conn *gorm.DB, attributionId AttributionID) (*CostCenter, error) {
	db := conn.WithContext(ctx)
	var costCenter CostCenter

	result := db.First(&costCenter, attributionId)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, CostCenterNotFound
		}
		return nil, fmt.Errorf("failed to get cost center: %w", result.Error)

	}

	return &costCenter, nil
}
