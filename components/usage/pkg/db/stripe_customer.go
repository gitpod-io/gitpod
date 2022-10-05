// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type StripeCustomer struct {
	// CustomerID is the Stripe Subscription ID
	CustomerID    string        `gorm:"primary_key;column:customerId;type:char;size:36;" json:"customerId"`
	AttributionID AttributionID `gorm:"column:attributionId;type:varchar;size:255;" json:"attributionId"`

	// Created is the time when this record was created.
	Created time.Time `gorm:"column:_created;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_created"`

	LastModified time.Time `gorm:"->:column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
}

// TableName sets the insert table name for this struct type
func (d *StripeCustomer) TableName() string {
	return "d_b_stripe_customer"
}

func CreateStripeCustomer(ctx context.Context, conn *gorm.DB, sub StripeCustomer) (StripeCustomer, error) {
	tx := conn.WithContext(ctx).Create(&sub)
	if tx.Error != nil {
		return StripeCustomer{}, fmt.Errorf("failed to create stripe subscription: %w", tx.Error)
	}

	return sub, nil
}

func GetStripeStripeCustomer(ctx context.Context, conn *gorm.DB, attributionID AttributionID) (StripeCustomer, error) {
	var subs []StripeCustomer
	tx := conn.
		Where("attributionId = ?", attributionID).
		Find(&subs)
	if tx.Error != nil {
		return StripeCustomer{}, fmt.Errorf("failed to get stripe subscription by attribution ID %s: %w", attributionID, tx.Error)
	}
	if len(subs) == 0 {
		return StripeCustomer{}, fmt.Errorf("no subscriptions for attribution ID %s: %w", attributionID, NotFoundError)
	}
	if len(subs) > 1 {
		return StripeCustomer{}, fmt.Errorf("more than one (got %d) active stripe subscription found - invalid state", len(subs))
	}

	return subs[0], nil
}
