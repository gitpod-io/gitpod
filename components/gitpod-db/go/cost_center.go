// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"strings"
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
	ID                AttributionID   `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	CreationTime      VarcharTime     `gorm:"primary_key;column:creationTime;type:varchar;size:255;" json:"creationTime"`
	SpendingLimit     int32           `gorm:"column:spendingLimit;type:int;default:0;" json:"spendingLimit"`
	BillingStrategy   BillingStrategy `gorm:"column:billingStrategy;type:varchar;size:255;" json:"billingStrategy"`
	BillingCycleStart VarcharTime     `gorm:"column:billingCycleStart;type:varchar;size:255;" json:"billingCycleStart"`
	NextBillingTime   VarcharTime     `gorm:"column:nextBillingTime;type:varchar;size:255;" json:"nextBillingTime"`
	LastModified      time.Time       `gorm:"->;column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
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
			result = CostCenter{
				ID:                attributionID,
				CreationTime:      NewVarCharTime(now),
				BillingStrategy:   CostCenter_Other,
				SpendingLimit:     c.getSpendingLimitForNewCostCenter(attributionID),
				BillingCycleStart: NewVarCharTime(now),
				NextBillingTime:   NewVarCharTime(now.AddDate(0, 1, 0)),
			}
			err := c.conn.Save(&result).Error
			if err != nil {
				if strings.HasPrefix(err.Error(), "Error 1062: Duplicate entry") {
					// This can happen if we have multiple concurrent requests for the same attributionID.
					logger.WithError(err).Info("Concurrent save.")
					return getCostCenter(ctx, c.conn, attributionID)
				}
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
	if result.BillingStrategy != CostCenter_Stripe && result.IsExpired() {
		cc, err := c.ResetUsage(ctx, result.ID)
		if err != nil {
			logger.WithError(err).Error("Failed to reset expired usage.")
			return CostCenter{}, fmt.Errorf("failed to reset usage for expired cost center ID: %s: %w", result.ID, err)
		}

		return cc, nil
	}

	return result, nil
}

// computeDefaultSpendingLimit computes the spending limit for a new Organization.
// If the first joined member has not already granted credits to another org, we grant them the free credits allowance.
func (c *CostCenterManager) getSpendingLimitForNewCostCenter(attributionID AttributionID) int32 {
	_, orgId := attributionID.Values()
	orgUUID, err := uuid.Parse(orgId)
	if err != nil {
		log.WithError(err).WithField("attributionId", attributionID).Error("Failed to parse orgId.")
		return c.cfg.ForTeams
	}

	// fetch the first user that joined the org
	var userId string
	db := c.conn.Raw(`
		SELECT userid
		FROM d_b_team_membership
		WHERE
			teamId = ?
		ORDER BY creationTime
		LIMIT 1
	`, orgId).Scan(&userId)
	if db.Error != nil {
		log.WithError(db.Error).WithField("attributionId", attributionID).Error("Failed to get userId for org.")
		return c.cfg.ForTeams
	}

	if userId == "" {
		log.WithField("attributionId", attributionID).Error("Failed to get userId for org.")
		return c.cfg.ForTeams
	}

	userUUID, err := uuid.Parse(userId)
	if err != nil {
		log.WithError(err).WithField("attributionId", attributionID).Error("Failed to parse userId for org.")
		return c.cfg.ForTeams
	}

	// check if the user has already granted free credits to another org
	type FreeCredit struct {
		UserID         uuid.UUID `gorm:"primary_key;column:userId;type:char(36)"`
		Email          string    `gorm:"column:email;type:varchar(255)"`
		OrganizationID uuid.UUID `gorm:"column:organizationId;type:char(36)"`
	}

	// fetch primaryEmail from d_b_identity
	var primaryEmail string
	db = c.conn.Raw(`
		SELECT primaryEmail
		FROM d_b_identity
		WHERE
			userid = ?
		LIMIT 1
	`, userId).Scan(&primaryEmail)
	if db.Error != nil {
		log.WithError(db.Error).WithField("attributionId", attributionID).Error("Failed to get primaryEmail for user.")
		return c.cfg.ForTeams
	}

	var freeCredit FreeCredit

	// check if the user has already granted free credits to another org
	db = c.conn.Table("d_b_free_credits").Where(&FreeCredit{UserID: userUUID}).Or(
		&FreeCredit{Email: primaryEmail}).First(&freeCredit)
	if db.Error != nil {
		if errors.Is(db.Error, gorm.ErrRecordNotFound) {
			// no record was found, so let's insert a new one
			freeCredit = FreeCredit{UserID: userUUID, Email: primaryEmail, OrganizationID: orgUUID}
			db = c.conn.Table("d_b_free_credits").Save(&freeCredit)
			if db.Error != nil {
				log.WithError(db.Error).WithField("attributionId", attributionID).Error("Failed to insert free credits.")
				return c.cfg.ForTeams
			}
			return c.cfg.ForUsers
		} else {
			// some other database error occurred
			log.WithError(db.Error).WithField("attributionId", attributionID).Error("Failed to get first org for user.")
			return c.cfg.ForTeams
		}
	}
	// a record was found, so we already granted free credits to another org
	return c.cfg.ForTeams
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

func (c *CostCenterManager) IncrementBillingCycle(ctx context.Context, attributionId AttributionID) (CostCenter, error) {
	cc, err := getCostCenter(ctx, c.conn, attributionId)
	if err != nil {
		return CostCenter{}, err
	}
	now := time.Now().UTC()
	if cc.NextBillingTime.Time().After(now) {
		log.Infof("Cost center %s is not yet expired. Skipping increment.", attributionId)
		return cc, nil
	}
	billingCycleStart := now
	if cc.NextBillingTime.IsSet() {
		billingCycleStart = cc.NextBillingTime.Time()
	}
	nextBillingTime := billingCycleStart.AddDate(0, 1, 0)
	for nextBillingTime.Before(now) {
		log.Warnf("Billing cycle for %s is lagging behind. Incrementing by one month.", attributionId)
		billingCycleStart = billingCycleStart.AddDate(0, 1, 0)
		nextBillingTime = billingCycleStart.AddDate(0, 1, 0)
	}
	// All fields on the new cost center remain the same, except for BillingCycleStart, NextBillingTime, and CreationTime
	newCostCenter := CostCenter{
		ID:                cc.ID,
		SpendingLimit:     cc.SpendingLimit,
		BillingStrategy:   cc.BillingStrategy,
		BillingCycleStart: NewVarCharTime(billingCycleStart),
		NextBillingTime:   NewVarCharTime(nextBillingTime),
		CreationTime:      NewVarCharTime(now),
	}
	err = c.conn.Save(&newCostCenter).Error
	if err != nil {
		return CostCenter{}, fmt.Errorf("failed to store cost center ID: %s", err)
	}
	return newCostCenter, nil
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
	newCC.CreationTime = NewVarCharTime(now)
	// we don't allow setting billingCycleStart or nextBillingTime from outside
	newCC.BillingCycleStart = existingCC.BillingCycleStart
	newCC.NextBillingTime = existingCC.NextBillingTime

	// Transitioning into free plan
	if existingCC.BillingStrategy != CostCenter_Other && newCC.BillingStrategy == CostCenter_Other {
		newCC.SpendingLimit, err = c.getPreviousSpendingLimit(newCC.ID)
		if err != nil {
			return CostCenter{}, err
		}
		newCC.BillingCycleStart = NewVarCharTime(now)
		// see you next month
		newCC.NextBillingTime = NewVarCharTime(now.AddDate(0, 1, 0))
	}

	// Upgrading to Stripe
	if existingCC.BillingStrategy != CostCenter_Stripe && newCC.BillingStrategy == CostCenter_Stripe {
		err := c.BalanceOutUsage(ctx, attributionID, 0)
		if err != nil {
			return CostCenter{}, err
		}

		newCC.BillingCycleStart = NewVarCharTime(now)
		// set an informative nextBillingTime, even though we don't manage Stripe billing cycle
		newCC.NextBillingTime = NewVarCharTime(now.AddDate(0, 1, 0))
	}

	log.WithField("cost_center", newCC).Info("saving cost center.")
	db := c.conn.Save(&newCC)
	if db.Error != nil {
		return CostCenter{}, fmt.Errorf("failed to save cost center for attributionID %s: %w", newCC.ID, db.Error)
	}
	return newCC, nil
}

func (c *CostCenterManager) getPreviousSpendingLimit(attributionID AttributionID) (int32, error) {
	var previousCostCenter CostCenter
	// find the youngest cost center with billingStrategy='other'
	db := c.conn.
		Where("id = ? AND billingStrategy = ?", attributionID, CostCenter_Other).
		Order("creationTime DESC").
		Limit(1).
		Find(&previousCostCenter)
	if db.Error != nil {
		return 0, fmt.Errorf("failed to get previous cost center: %w", db.Error)
	}
	if previousCostCenter.ID == "" {
		return c.cfg.ForTeams, nil
	}
	return previousCostCenter.SpendingLimit, nil
}

func (c *CostCenterManager) BalanceOutUsage(ctx context.Context, attributionID AttributionID, maxCreditCentsCovered CreditCents) error {
	// moving to stripe -> let's run a finalization
	finalizationUsage, err := c.newInvoiceUsageRecord(ctx, attributionID, maxCreditCentsCovered)
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

func (c *CostCenterManager) newInvoiceUsageRecord(ctx context.Context, attributionID AttributionID, maxCreditCentsCovered CreditCents) (*Usage, error) {
	now := time.Now()
	creditCents, err := GetBalance(ctx, c.conn, attributionID)
	if err != nil {
		return nil, err
	}
	if creditCents.ToCredits() <= 0 {
		// account has no debt, do nothing
		return nil, nil
	}
	if maxCreditCentsCovered != 0 && creditCents > maxCreditCentsCovered {
		creditCents = maxCreditCentsCovered
	}
	return &Usage{
		ID:            uuid.New(),
		AttributionID: attributionID,
		Description:   "Credits",
		CreditCents:   creditCents * -1,
		EffectiveTime: NewVarCharTime(now),
		Kind:          InvoiceUsageKind,
		Draft:         false,
	}, nil
}

func (c *CostCenterManager) ListManagedCostCentersWithBillingTimeBefore(ctx context.Context, billingTimeBefore time.Time) ([]CostCenter, error) {
	db := c.conn.WithContext(ctx)

	var results []CostCenter
	var batch []CostCenter

	subquery := db.Table((&CostCenter{}).TableName()).
		// Retrieve the latest CostCenter for a given (attribution) ID.
		Select("DISTINCT id, MAX(creationTime) AS creationTime").
		Group("id")
	tx := db.Table(fmt.Sprintf("%s as cc", (&CostCenter{}).TableName())).
		// Join on our set of latest CostCenter records
		Joins("INNER JOIN (?) AS expiredCC on cc.id = expiredCC.id AND cc.creationTime = expiredCC.creationTime", subquery).
		Where("cc.billingStrategy != ?", CostCenter_Stripe). // Stripe is managed externally
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

func (c *CostCenterManager) ResetUsage(ctx context.Context, id AttributionID) (CostCenter, error) {
	logger := log.WithField("attribution_id", id)
	cc, err := getCostCenter(ctx, c.conn, id)
	if err != nil {
		return cc, err
	}
	logger = logger.WithField("cost_center", cc)
	if cc.BillingStrategy == CostCenter_Stripe {
		return CostCenter{}, fmt.Errorf("cannot reset usage for Billing Strategy %s for Cost Center ID: %s", cc.BillingStrategy, cc.ID)
	}
	if !cc.IsExpired() {
		logger.Info("Skipping ResetUsage because next billing cycle is in the future.")
		return cc, nil
	}

	logger.Info("Running `ResetUsage`.")
	cc, err = c.IncrementBillingCycle(ctx, cc.ID)
	if err != nil {
		return CostCenter{}, fmt.Errorf("failed to increment billing cycle for AttributonID: %s: %w", cc.ID, err)
	}

	// Create a synthetic Invoice Usage record, to reset usage
	err = c.BalanceOutUsage(ctx, cc.ID, NewCreditCents(float64(cc.SpendingLimit)))
	if err != nil {
		return CostCenter{}, fmt.Errorf("failed to compute invocie usage record for AttributonID: %s: %w", cc.ID, err)
	}

	return cc, nil
}
