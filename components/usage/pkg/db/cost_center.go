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

type BillingStrategy string

const (
	CostCenter_Stripe BillingStrategy = "stripe"
	CostCenter_Other  BillingStrategy = "other"
)

type CostCenter struct {
	ID              AttributionID   `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	CreationTime    VarcharTime     `gorm:"primary_key;column:creationTime;type:varchar;size:255;" json:"creationTime"`
	SpendingLimit   int32           `gorm:"column:spendingLimit;type:int;default:0;" json:"spendingLimit"`
	BillingStrategy BillingStrategy `gorm:"column:billingStrategy;type:varchar;size:255;" json:"billingStrategy"`

	LastModified time.Time `gorm:"->:column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
}

// TableName sets the insert table name for this struct type
func (d *CostCenter) TableName() string {
	return "d_b_cost_center"
}

func GetCostCenter(ctx context.Context, conn *gorm.DB, attributionId AttributionID) (*CostCenter, error) {
	db := conn.WithContext(ctx)

	var results []CostCenter
	db = db.Where("id = ?", attributionId).Order("creationTime DESC").Limit(1).Find(&results)
	if db.Error != nil {
		return nil, fmt.Errorf("failed to get cost center: %w", db.Error)
	}
	if len(results) == 0 {
		return nil, CostCenterNotFound
	}
	costCenter := results[0]
	return &costCenter, nil
}

func SaveCostCenter(ctx context.Context, conn *gorm.DB, costCenter *CostCenter) (*CostCenter, error) {
	db := conn.WithContext(ctx)
	costCenter.CreationTime = NewVarcharTime(time.Now())
	db = db.Save(costCenter)
	if db.Error != nil {
		return nil, fmt.Errorf("failed to save cost center: %w", db.Error)
	}
	return costCenter, nil
}
