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
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
	NextBillingTime VarcharTime     `gorm:"column:nextBillingTime;type:varchar;size:255;" json:"nextBillingTime"`
	LastModified    time.Time       `gorm:"->;column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
}

// TableName sets the insert table name for this struct type
func (c *CostCenter) TableName() string {
	return "d_b_cost_center"
}

func (c *CostCenter) IsExpired() bool {
	if !c.NextBillingTime.IsSet() {
		return false
	}

	return c.NextBillingTime.Time().Before(time.Now().UTC())
}

type DefaultSpendingLimit struct {
	ForTeams            int32 `json:"forTeams"`
	ForUsers            int32 `json:"forUsers"`
	MinForUsersOnStripe int32 `json:"minForUsersOnStripe"`
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
	now := time.Now().UTC()

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
				CreationTime:    NewVarcharTime(now),
				BillingStrategy: CostCenter_Other,
				SpendingLimit:   defaultSpendingLimit,
				NextBillingTime: NewVarcharTime(now.AddDate(0, 1, 0)),
			}
			err := c.conn.Save(&result).Error
			if err != nil {
				return CostCenter{}, err
			}
			return result, nil
		} else {
			return CostCenter{}, err
		}
	}

	// If we retrieved a CostCenter which is not on Stripe, and the NextBillingPeriod is expired,
	// we want to reset it immediately.
	// This can happen in the following scenario:
	//	* User accesses gitpod just after their CostCenter expired, but just before our periodic CostCenter reset kicks in.
	if result.BillingStrategy == CostCenter_Other && result.IsExpired() {
		cc, err := c.ResetUsage(ctx, result)
		if err != nil {
			logger.WithError(err).Error("Failed to reset expired usage.")
			return CostCenter{}, fmt.Errorf("failed to reset usage for expired cost center ID: %s: %w", result.ID, err)
		}

		return cc, nil
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

func (c *CostCenterManager) UpdateCostCenter(ctx context.Context, newCC CostCenter) (CostCenter, error) {
	if newCC.SpendingLimit < 0 {
		return CostCenter{}, status.Errorf(codes.InvalidArgument, "Spending limit cannot be set below zero.")
	}

	attributionID := newCC.ID
	// retrieving the existing cost center to maintain the readonly values
	existingCC, err := c.GetOrCreateCostCenter(ctx, newCC.ID)
	if err != nil {
		return CostCenter{}, status.Errorf(codes.NotFound, "cost center does not exist")
	}

	now := time.Now()

	// we always update the creationTime
	newCC.CreationTime = NewVarcharTime(now)
	// we don't allow setting the nextBillingTime from outside
	newCC.NextBillingTime = existingCC.NextBillingTime

	isTeam := attributionID.IsEntity(AttributionEntity_Team)
	isUser := attributionID.IsEntity(AttributionEntity_User)

	if isUser {
		// New billing strategy is Stripe
		if newCC.BillingStrategy == CostCenter_Stripe {
			if newCC.SpendingLimit < c.cfg.MinForUsersOnStripe {
				return CostCenter{}, status.Errorf(codes.FailedPrecondition, "individual users cannot lower their spending below %d", c.cfg.ForUsers)
			}
		}

		// Billing strategy remains unchanged (Other)
		if newCC.BillingStrategy == CostCenter_Other && existingCC.BillingStrategy == CostCenter_Other {
			if newCC.SpendingLimit != existingCC.SpendingLimit {
				return CostCenter{}, status.Errorf(codes.FailedPrecondition, "individual users on a free plan cannot adjust their spending limit")
			}
		}

		// Downgrading from stripe
		if existingCC.BillingStrategy == CostCenter_Stripe && newCC.BillingStrategy == CostCenter_Other {
			newCC.SpendingLimit = c.cfg.ForUsers
			// see you next month
			newCC.NextBillingTime = NewVarcharTime(now.AddDate(0, 1, 0))
		}

		// Upgrading to Stripe
		if existingCC.BillingStrategy == CostCenter_Other && newCC.BillingStrategy == CostCenter_Stripe {
			err := c.BalanceOutUsage(ctx, attributionID)
			if err != nil {
				return CostCenter{}, err
			}

			// we don't manage stripe billing cycle
			newCC.NextBillingTime = VarcharTime{}
		}
	} else if isTeam {
		// Billing strategy is Other, and it remains unchanged
		if existingCC.BillingStrategy == CostCenter_Other && newCC.BillingStrategy == CostCenter_Other {
			// It is impossible for a team without Stripe billing to change their spending limit
			if newCC.SpendingLimit != c.cfg.ForTeams {
				return CostCenter{}, status.Errorf(codes.FailedPrecondition, "teams without a subscription cannot change their spending limit")
			}
		}

		// Downgrading from stripe
		if existingCC.BillingStrategy == CostCenter_Stripe && newCC.BillingStrategy == CostCenter_Other {
			newCC.SpendingLimit = c.cfg.ForTeams
			// see you next month
			newCC.NextBillingTime = NewVarcharTime(now.AddDate(0, 1, 0))
		}

		// Upgrading to Stripe
		if existingCC.BillingStrategy == CostCenter_Other && newCC.BillingStrategy == CostCenter_Stripe {
			err := c.BalanceOutUsage(ctx, attributionID)
			if err != nil {
				return CostCenter{}, err
			}

			// we don't manage stripe billing cycle
			newCC.NextBillingTime = VarcharTime{}
		}
	} else {
		return CostCenter{}, status.Errorf(codes.InvalidArgument, "Unknown attribution entity %s", string(attributionID))
	}

	log.WithField("cost_center", newCC).Info("saving cost center.")
	db := c.conn.Save(&newCC)
	if db.Error != nil {
		return CostCenter{}, fmt.Errorf("failed to save cost center for attributionID %s: %w", newCC.ID, db.Error)
	}
	return newCC, nil
}

func (c *CostCenterManager) BalanceOutUsage(ctx context.Context, attributionID AttributionID) error {
	// moving to stripe -> let's run a finalization
	finalizationUsage, err := c.NewInvoiceUsageRecord(ctx, attributionID)
	if err != nil {
		return err
	}
	if finalizationUsage != nil {
		err = UpdateUsage(ctx, c.conn, *finalizationUsage)
		if err != nil {
			return err
		}
	}

	return nil
}

func (c *CostCenterManager) NewInvoiceUsageRecord(ctx context.Context, attributionID AttributionID) (*Usage, error) {
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

func (c *CostCenterManager) ListLatestCostCentersWithBillingTimeBefore(ctx context.Context, strategy BillingStrategy, billingTimeBefore time.Time) ([]CostCenter, error) {
	db := c.conn.WithContext(ctx)

	var results []CostCenter
	var batch []CostCenter

	subquery := db.
		Table((&CostCenter{}).TableName()).
		// Retrieve the latest CostCenter for a given (attribution) ID.
		Select("DISTINCT id, MAX(creationTime) AS creationTime").
		Group("id")
	tx := db.
		Table(fmt.Sprintf("%s as cc", (&CostCenter{}).TableName())).
		// Join on our set of latest CostCenter records
		Joins("INNER JOIN (?) AS expiredCC on cc.id = expiredCC.id AND cc.creationTime = expiredCC.creationTime", subquery).
		Where("cc.billingStrategy = ?", strategy).
		Where("nextBillingTime != ?", "").
		Where("nextBillingTime < ?", TimeToISO8601(billingTimeBefore)).
		FindInBatches(&batch, 1000, func(tx *gorm.DB, iteration int) error {
			results = append(results, batch...)
			return nil
		})

	if tx.Error != nil {
		return nil, fmt.Errorf("failed to list cost centers with billing time before: %w", tx.Error)
	}

	return results, nil
}

func (c *CostCenterManager) ResetUsage(ctx context.Context, cc CostCenter) (CostCenter, error) {
	if cc.BillingStrategy != CostCenter_Other {
		return CostCenter{}, fmt.Errorf("cannot reset usage for Billing Strategy %s for Cost Center ID: %s", cc.BillingStrategy, cc.ID)
	}

	entity, _ := cc.ID.Values()

	// We do not carry over the spending limit from the existing CostCenter.
	// At the moment, we don't have a use case for it. Getting the spending limit from configured values
	// ensures that we progressively update the spending limit to configured values rather than having to
	// perform bulk DB queries when the defaults do change.
	var spendingLimit int32
	switch entity {
	case AttributionEntity_Team:
		spendingLimit = c.cfg.ForTeams
	case AttributionEntity_User:
		spendingLimit = c.cfg.ForUsers
	default:
		return CostCenter{}, fmt.Errorf("cannot reset usage for unknown attribution entity ID: %s", cc.ID)
	}

	now := time.Now().UTC()

	// Default to 1 month from now, if there's no nextBillingTime set on the record.
	nextBillingTime := now.AddDate(0, 1, 0)
	if cc.NextBillingTime.IsSet() {
		nextBillingTime = cc.NextBillingTime.Time().AddDate(0, 1, 0)
	}

	// Create a synthetic Invoice Usage record, to reset usage
	err := c.BalanceOutUsage(ctx, cc.ID)
	if err != nil {
		return CostCenter{}, fmt.Errorf("failed to compute invocie usage record for AttributonID: %s: %w", cc.ID, err)
	}

	// All fields on the new cost center remain the same, except for CreationTime and NextBillingTime
	newCostCenter := CostCenter{
		ID:              cc.ID,
		SpendingLimit:   spendingLimit,
		BillingStrategy: cc.BillingStrategy,
		NextBillingTime: NewVarcharTime(nextBillingTime),
		CreationTime:    NewVarcharTime(now),
	}
	err = c.conn.Save(&newCostCenter).Error
	if err != nil {
		return CostCenter{}, fmt.Errorf("failed to store new cost center for AttribtuonID: %s: %w", cc.ID, err)
	}

	return newCostCenter, nil
}
