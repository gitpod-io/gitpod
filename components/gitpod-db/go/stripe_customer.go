// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type StripeCustomer struct {
	StripeCustomerID      string        `gorm:"primary_key;column:stripeCustomerId;type:char;size:255;" json:"stripeCustomerId"`
	AttributionID         AttributionID `gorm:"column:attributionId;type:varchar;size:255;" json:"attributionId"`
	CreationTime          VarcharTime   `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	Currency              string        `gorm:"column:currency;type:varchar;size:3;" json:"currency"`
	InvalidBillingAddress *bool         `gorm:"column:invalidBillingAddress;type:tinyint;default:null;" json:"invalidBillingAddress"`

	LastModified time.Time `gorm:"->;column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
	// deleted is reserved for use by periodic deleter
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *StripeCustomer) TableName() string {
	return "d_b_stripe_customer"
}

func CreateStripeCustomer(ctx context.Context, conn *gorm.DB, customer StripeCustomer) error {
	if !customer.CreationTime.IsSet() {
		customer.CreationTime = NewVarCharTime(time.Now())
	}

	tx := conn.WithContext(ctx).Create(customer)
	if tx.Error != nil {
		return fmt.Errorf("failed to create StripeCustomer ID %s: %w", customer.StripeCustomerID, tx.Error)
	}

	return nil
}

func GetStripeCustomer(ctx context.Context, conn *gorm.DB, stripeCustomerID string) (StripeCustomer, error) {
	var customer StripeCustomer
	tx := conn.
		WithContext(ctx).
		Where("stripeCustomerId = ?", stripeCustomerID).
		First(&customer)
	if err := tx.Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return StripeCustomer{}, fmt.Errorf("stripe customer with ID %s does not exist: %w", stripeCustomerID, ErrorNotFound)
		}

		return StripeCustomer{}, fmt.Errorf("failed to lookup stripe customer with ID %s: %w", stripeCustomerID, err)
	}

	return customer, nil
}

func GetStripeCustomerByAttributionID(ctx context.Context, conn *gorm.DB, attributionID AttributionID) (StripeCustomer, error) {
	var customer StripeCustomer
	tx := conn.
		WithContext(ctx).
		Where("attributionId = ?", string(attributionID)).
		Order("creationTime DESC").
		First(&customer)
	if err := tx.Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return StripeCustomer{}, fmt.Errorf("stripe customer with attribution ID %s does not exist: %w", attributionID, ErrorNotFound)
		}

		return StripeCustomer{}, fmt.Errorf("failed to lookup stripe customer with attribution ID %s", attributionID)
	}

	return customer, nil
}

func UpdateStripeCustomerInvalidBillingAddress(ctx context.Context, conn *gorm.DB, stripeCustomerID string, invalidBillingAddress bool) (StripeCustomer, error) {
	tx := conn.
		WithContext(ctx).
		Model(&StripeCustomer{}).
		Where("stripeCustomerId = ?", stripeCustomerID).
		Where("deleted = ?", 0).
		Update("invalidBillingAddress", BoolPointer(invalidBillingAddress))

	if err := tx.Error; err != nil {
		return StripeCustomer{}, fmt.Errorf("failed to update stripe customer with ID %s: %w", stripeCustomerID, err)
	}

	return GetStripeCustomer(ctx, conn, stripeCustomerID)
}
