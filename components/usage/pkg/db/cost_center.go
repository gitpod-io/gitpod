// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/google/uuid"
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
	// StripeCustomerID is the Stripe Customer ID used when the BillingStrategy is set to CostCenter_Stripe
	StripeCustomerID string      `gorm:"column:stripeCustomerId;type:varchar;size:255;" json:"stripeCustomerId"`
	NextBillingTime  VarcharTime `gorm:"column:nextBillingTime;type:varchar;size:255;" json:"nextBillingTime"`
	LastModified     time.Time   `gorm:"->:column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
}

// TableName sets the insert table name for this struct type
func (d *CostCenter) TableName() string {
	return "d_b_cost_center"
}

type DefaultSpendingLimit struct {
	ForTeams int32 `json:"forTeams"`
	ForUsers int32 `json:"forUsers"`
}

func NewCostCenterManager(conn *gorm.DB, cfg DefaultSpendingLimit) *CostCenterManager {
	return &CostCenterManager{
		conn: conn,
		cfg:  cfg,
	}
}

type CostCenterManager struct {
	conn *gorm.DB
	cfg  DefaultSpendingLimit
}

// GetOrCreateCostCenter returns the latest version of cost center for the given attributionID.
// This method creates a codt center and stores it in the DB if there is no preexisting one.
func (c *CostCenterManager) GetOrCreateCostCenter(ctx context.Context, attributionID AttributionID) (CostCenter, error) {
	logger := log.WithField("attributionId", attributionID)

	result, err := getCostCenter(ctx, c.conn, attributionID)
	if err != nil {
		if errors.Is(err, CostCenterNotFound) {
			logger.Info("No existing cost center. Creating one.")
			defaultSpendingLimit := c.cfg.ForUsers
			if attributionID.IsEntity(AttributionEntity_Team) {
				defaultSpendingLimit = c.cfg.ForTeams
			}
			result = CostCenter{
				ID:              attributionID,
				CreationTime:    NewVarcharTime(time.Now()),
				BillingStrategy: CostCenter_Other,
				SpendingLimit:   defaultSpendingLimit,
				NextBillingTime: NewVarcharTime(time.Now().AddDate(0, 1, 0)),
			}
			err := c.conn.Save(&result).Error
			if err != nil {
				return CostCenter{}, err
			}
		} else {
			return CostCenter{}, err
		}
	}

	return result, nil
}

func getCostCenter(ctx context.Context, conn *gorm.DB, attributionId AttributionID) (CostCenter, error) {
	db := conn.WithContext(ctx)

	var results []CostCenter
	db = db.Where("id = ?", attributionId).Order("creationTime DESC").Limit(1).Find(&results)
	if db.Error != nil {
		return CostCenter{}, fmt.Errorf("failed to get cost center: %w", db.Error)
	}
	if len(results) == 0 {
		return CostCenter{}, CostCenterNotFound
	}
	costCenter := results[0]
	return costCenter, nil
}

func (c *CostCenterManager) UpdateCostCenter(ctx context.Context, costCenter CostCenter) (CostCenter, error) {

	// retrieving the existing cost center to maintain the readonly values
	existingCostCenter, err := c.GetOrCreateCostCenter(ctx, costCenter.ID)
	if err != nil {
		return CostCenter{}, err
	}

	now := time.Now()

	// we always update the creationTime
	costCenter.CreationTime = NewVarcharTime(now)
	// we don't allow setting the nextBillingTime from outside
	costCenter.NextBillingTime = existingCostCenter.NextBillingTime

	// Do we have a billing strategy update?
	if costCenter.BillingStrategy != existingCostCenter.BillingStrategy {
		switch costCenter.BillingStrategy {
		case CostCenter_Stripe:
			if costCenter.StripeCustomerID == "" {
				return CostCenter{}, errors.New("billing strategy is Stripe, but StripeCustomerID is missing")
			}

			// moving to stripe -> let's run a finalization
			finalizationUsage, err := c.ComputeInvoiceUsageRecord(ctx, costCenter.ID)
			if err != nil {
				return CostCenter{}, err
			}
			if finalizationUsage != nil {
				err = UpdateUsage(ctx, c.conn, *finalizationUsage)
				if err != nil {
					return CostCenter{}, err
				}
			}
			// we don't manage stripe billing cycle
			costCenter.NextBillingTime = VarcharTime{}

		case CostCenter_Other:
			// cancelled from stripe reset the spending limit
			if costCenter.ID.IsEntity(AttributionEntity_Team) {
				costCenter.SpendingLimit = c.cfg.ForTeams
			} else {
				costCenter.SpendingLimit = c.cfg.ForUsers
			}

			// see you next month
			costCenter.NextBillingTime = NewVarcharTime(now.AddDate(0, 1, 0))

			// unset any Stripe customer reference
			costCenter.StripeCustomerID = ""
		}
	}

	log.WithField("cost_center", costCenter).Info("saving cost center.")
	db := c.conn.Save(&costCenter)
	if db.Error != nil {
		return CostCenter{}, fmt.Errorf("failed to save cost center for attributionID %s: %w", costCenter.ID, db.Error)
	}
	return costCenter, nil
}

func (c *CostCenterManager) ComputeInvoiceUsageRecord(ctx context.Context, attributionID AttributionID) (*Usage, error) {
	now := time.Now()
	creditCents, err := GetBalance(ctx, c.conn, attributionID)
	if err != nil {
		return nil, err
	}
	if creditCents.ToCredits() <= 0 {
		// account has no debt, do nothing
		return nil, nil
	}
	return &Usage{
		ID:            uuid.New(),
		AttributionID: attributionID,
		Description:   "Credits",
		CreditCents:   creditCents * -1,
		EffectiveTime: NewVarcharTime(now),
		Kind:          InvoiceUsageKind,
		Draft:         false,
	}, nil
}
