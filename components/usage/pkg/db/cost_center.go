// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"time"

	"github.com/google/uuid"
)

type CostCenter struct {
	ID            uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	SpendingLimit int       `gorm:"column:spendingLimit;type:int;default:0;" json:"spendingLimit"`
	LastModified  time.Time `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	// deleted is restricted for use by db-sync
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *CostCenter) TableName() string {
	return "d_b_cost_center"
}
