// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
)

// BilledSession represents the underlying DB object
type BilledSession struct {
	InstanceID   uuid.UUID   `gorm:"primary_key;column:instanceId;type:char;size:36;" json:"instanceId"`
	From         VarcharTime `gorm:"primary_key;column:from;type:varchar;size:255;" json:"from"`
	To           VarcharTime `gorm:"column:to;type:varchar;size:255;" json:"to"`
	System       string      `gorm:"column:system;type:varchar;size:255;" json:"system"`
	InvoiceID    string      `gorm:"column:invoiceId;type:varchar;size:255;" json:"invoiceId"`
	LastModified time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	// deleted is restricted for use by db-sync
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *BilledSession) TableName() string {
	return "d_b_billed_session"
}

func SetBilled(ctx context.Context, conn *gorm.DB, instanceID uuid.UUID, instanceCreationTime time.Time, system v1.System) error {
	database := conn.WithContext(ctx)

	var sys string
	switch system {
	case v1.System_SYSTEM_CHARGEBEE:
		sys = "chargebee"
	case v1.System_SYSTEM_STRIPE:
		sys = "stripe"
	default:
		sys = "unknown"
	}
	billedSession := BilledSession{InstanceID: instanceID, From: NewVarcharTime(instanceCreationTime), System: sys}
	return database.Create(&billedSession).Error
}

func GetBilled(ctx context.Context, conn *gorm.DB, instanceID uuid.UUID) ([]BilledSession, error) {
	var billedSessions []BilledSession
	db := conn.WithContext(ctx).Where("InstanceID = ?", instanceID).Find(&billedSessions)

	if db.Error != nil {
		return nil, fmt.Errorf("Billed session not found for instance ID: %w", db.Error)
	}

	return billedSessions, nil
}
