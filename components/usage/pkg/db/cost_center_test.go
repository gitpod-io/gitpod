// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

func TestCostCenter_WriteRead(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	costCenter := &db.CostCenter{
		ID:            db.NewTeamAttributionID(uuid.New().String()),
		SpendingLimit: 100,
	}
	cleanUp(t, conn, costCenter.ID)

	tx := conn.Create(costCenter)
	require.NoError(t, tx.Error)

	read := &db.CostCenter{ID: costCenter.ID}
	tx = conn.First(read)
	require.NoError(t, tx.Error)
	require.Equal(t, costCenter.ID, read.ID)
	require.Equal(t, costCenter.SpendingLimit, read.SpendingLimit)
}

func TestCostCenterManager_GetOrCreateCostCenter(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
		ForTeams: 0,
		ForUsers: 500,
	})
	team := db.NewTeamAttributionID(uuid.New().String())
	user := db.NewUserAttributionID(uuid.New().String())
	cleanUp(t, conn, team, user)

	teamCC, err := mnr.GetOrCreateCostCenter(context.Background(), team)
	require.NoError(t, err)
	userCC, err := mnr.GetOrCreateCostCenter(context.Background(), user)
	require.NoError(t, err)
	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(teamCC, userCC)
	})
	require.Equal(t, int32(0), teamCC.SpendingLimit)
	require.Equal(t, int32(500), userCC.SpendingLimit)
}

func TestCostCenterManager_GetOrCreateCostCenter_ResetsExpired(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
		ForTeams: 0,
		ForUsers: 500,
	})

	now := time.Now().UTC()
	ts := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), now.Second(), 0, time.UTC)
	expired := ts.Add(-1 * time.Minute)
	unexpired := ts.Add(1 * time.Minute)

	expiredCC := db.CostCenter{
		ID:              db.NewTeamAttributionID(uuid.New().String()),
		CreationTime:    db.NewVarcharTime(now),
		SpendingLimit:   0,
		BillingStrategy: db.CostCenter_Other,
		NextBillingTime: db.NewVarcharTime(expired),
	}
	unexpiredCC := db.CostCenter{
		ID:              db.NewUserAttributionID(uuid.New().String()),
		CreationTime:    db.NewVarcharTime(now),
		SpendingLimit:   500,
		BillingStrategy: db.CostCenter_Other,
		NextBillingTime: db.NewVarcharTime(unexpired),
	}
	// Stripe billing strategy should not be reset
	stripeCC := db.CostCenter{
		ID:              db.NewUserAttributionID(uuid.New().String()),
		CreationTime:    db.NewVarcharTime(now),
		SpendingLimit:   0,
		BillingStrategy: db.CostCenter_Stripe,
		NextBillingTime: db.VarcharTime{},
	}

	dbtest.CreateCostCenters(t, conn,
		dbtest.NewCostCenter(t, expiredCC),
		dbtest.NewCostCenter(t, unexpiredCC),
		dbtest.NewCostCenter(t, stripeCC),
	)

	// expired CostCenter should be reset, so we get a new CreationTime
	retrievedExpiredCC, err := mnr.GetOrCreateCostCenter(context.Background(), expiredCC.ID)
	require.NoError(t, err)
	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(retrievedExpiredCC.ID)
	})
	require.Equal(t, db.NewVarcharTime(expired).Time().AddDate(0, 1, 0), retrievedExpiredCC.NextBillingTime.Time())
	require.Equal(t, expiredCC.ID, retrievedExpiredCC.ID)
	require.Equal(t, expiredCC.BillingStrategy, retrievedExpiredCC.BillingStrategy)
	require.WithinDuration(t, now, expiredCC.CreationTime.Time(), 3*time.Second, "new cost center creation time must be within 3 seconds of now")

	// unexpired cost center must not be reset
	retrievedUnexpiredCC, err := mnr.GetOrCreateCostCenter(context.Background(), unexpiredCC.ID)
	require.NoError(t, err)
	require.Equal(t, db.NewVarcharTime(unexpired).Time(), retrievedUnexpiredCC.NextBillingTime.Time())
	require.Equal(t, unexpiredCC.ID, retrievedUnexpiredCC.ID)
	require.Equal(t, unexpiredCC.BillingStrategy, retrievedUnexpiredCC.BillingStrategy)
	require.WithinDuration(t, unexpiredCC.CreationTime.Time(), retrievedUnexpiredCC.CreationTime.Time(), 100*time.Millisecond)

	// stripe cost center must not be reset
	retrievedStripeCC, err := mnr.GetOrCreateCostCenter(context.Background(), stripeCC.ID)
	require.NoError(t, err)
	require.False(t, retrievedStripeCC.NextBillingTime.IsSet())
	require.Equal(t, stripeCC.ID, retrievedStripeCC.ID)
	require.Equal(t, stripeCC.BillingStrategy, retrievedStripeCC.BillingStrategy)
	require.WithinDuration(t, stripeCC.CreationTime.Time(), retrievedStripeCC.CreationTime.Time(), 100*time.Millisecond)
}

func TestCostCenterManager_UpdateCostCenter(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	limits := db.DefaultSpendingLimit{
		ForTeams:            0,
		ForUsers:            500,
		MinForUsersOnStripe: 1000,
	}

	t.Run("prevents updates to negative spending limit", func(t *testing.T) {
		mnr := db.NewCostCenterManager(conn, limits)
		userAttributionID := db.NewUserAttributionID(uuid.New().String())
		teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
		cleanUp(t, conn, userAttributionID, teamAttributionID)

		_, err := mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              userAttributionID,
			BillingStrategy: db.CostCenter_Other,
			SpendingLimit:   -1,
		})
		require.Error(t, err)
		require.Equal(t, codes.InvalidArgument, status.Code(err))

		_, err = mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              teamAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   -1,
		})
		require.Error(t, err)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("individual user on Other billing strategy cannot change spending limit of 500", func(t *testing.T) {
		mnr := db.NewCostCenterManager(conn, limits)
		userAttributionID := db.NewUserAttributionID(uuid.New().String())
		cleanUp(t, conn, userAttributionID)

		_, err := mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              userAttributionID,
			BillingStrategy: db.CostCenter_Other,
			SpendingLimit:   501,
		})
		require.Error(t, err)
		require.Equal(t, codes.FailedPrecondition, status.Code(err))

	})

	t.Run("individual user upgrading to stripe can set a limit of 1000 or more, but not less than 1000", func(t *testing.T) {
		mnr := db.NewCostCenterManager(conn, limits)
		userAttributionID := db.NewUserAttributionID(uuid.New().String())
		cleanUp(t, conn, userAttributionID)

		// Upgrading to Stripe requires spending limit
		res, err := mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              userAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   1000,
		})
		require.NoError(t, err)
		requireCostCenterEqual(t, db.CostCenter{
			ID:              userAttributionID,
			SpendingLimit:   1000,
			BillingStrategy: db.CostCenter_Stripe,
		}, res)

		// Try to lower the spending limit below configured limit
		_, err = mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              userAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   999,
		})
		require.Error(t, err, "lowering spending limit  below configured value is not allowed for user subscriptions")

		// Try to update the cost center to higher usage limit
		res, err = mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              userAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   1001,
		})
		require.NoError(t, err)
		requireCostCenterEqual(t, db.CostCenter{
			ID:              userAttributionID,
			SpendingLimit:   1001,
			BillingStrategy: db.CostCenter_Stripe,
		}, res)
	})

	t.Run("team on Other billing strategy get a spending limit of 0, and cannot change it", func(t *testing.T) {
		mnr := db.NewCostCenterManager(conn, limits)
		teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
		cleanUp(t, conn, teamAttributionID)

		// Allows udpating cost center as long as spending limit remains as configured
		res, err := mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              teamAttributionID,
			BillingStrategy: db.CostCenter_Other,
			SpendingLimit:   limits.ForTeams,
		})
		require.NoError(t, err)
		requireCostCenterEqual(t, db.CostCenter{
			ID:              teamAttributionID,
			SpendingLimit:   limits.ForTeams,
			BillingStrategy: db.CostCenter_Other,
		}, res)

		// Prevents updating when spending limit changes
		_, err = mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              teamAttributionID,
			BillingStrategy: db.CostCenter_Other,
			SpendingLimit:   1,
		})
		require.Error(t, err)
	})

	t.Run("team on Stripe billing strategy can set arbitrary positive spending limit", func(t *testing.T) {
		mnr := db.NewCostCenterManager(conn, limits)
		teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
		cleanUp(t, conn, teamAttributionID)

		// Allows udpating cost center as long as spending limit remains as configured
		res, err := mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              teamAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   limits.ForTeams,
		})
		require.NoError(t, err)
		requireCostCenterEqual(t, db.CostCenter{
			ID:              teamAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   limits.ForTeams,
		}, res)

		// Allows updating cost center to any positive value
		_, err = mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              teamAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   10,
		})
		require.NoError(t, err)
	})
}

func TestSaveCostCenterMovedToStripe(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
		ForTeams: 20,
		ForUsers: 500,
	})
	team := db.NewTeamAttributionID(uuid.New().String())
	cleanUp(t, conn, team)
	teamCC, err := mnr.GetOrCreateCostCenter(context.Background(), team)
	require.NoError(t, err)
	require.Equal(t, int32(20), teamCC.SpendingLimit)

	teamCC.BillingStrategy = db.CostCenter_Stripe
	teamCC.SpendingLimit = 400050
	teamCC, err = mnr.UpdateCostCenter(context.Background(), teamCC)
	require.NoError(t, err)
	require.Equal(t, db.CostCenter_Stripe, teamCC.BillingStrategy)
	require.Equal(t, db.VarcharTime{}, teamCC.NextBillingTime)
	require.Equal(t, int32(400050), teamCC.SpendingLimit)

	teamCC.BillingStrategy = db.CostCenter_Other
	teamCC, err = mnr.UpdateCostCenter(context.Background(), teamCC)
	require.NoError(t, err)
	require.Equal(t, teamCC.CreationTime.Time().AddDate(0, 1, 0).Truncate(time.Second), teamCC.NextBillingTime.Time().Truncate(time.Second))
	require.Equal(t, int32(20), teamCC.SpendingLimit)
}

func cleanUp(t *testing.T, conn *gorm.DB, attributionIds ...db.AttributionID) {
	t.Helper()
	t.Cleanup(func() {
		for _, attributionId := range attributionIds {
			conn.Where("id = ?", string(attributionId)).Delete(&db.CostCenter{})
			conn.Where("attributionId = ?", string(attributionId)).Delete(&db.Usage{})
		}
	})
}

func requireCostCenterEqual(t *testing.T, expected, actual db.CostCenter) {
	t.Helper()

	// ignore timestamps in comparsion
	require.Equal(t, expected.ID, actual.ID)
	require.EqualValues(t, expected.SpendingLimit, actual.SpendingLimit)
	require.Equal(t, expected.BillingStrategy, actual.BillingStrategy)
}

func TestCostCenter_ListLatestCostCentersWithBillingTimeBefore(t *testing.T) {

	t.Run("no cost centers found when no data exists", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: 0,
			ForUsers: 500,
		})

		ts := time.Date(2022, 10, 10, 10, 10, 10, 10, time.UTC)

		retrieved, err := mnr.ListLatestCostCentersWithBillingTimeBefore(context.Background(), db.CostCenter_Other, ts.Add(7*24*time.Hour))
		require.NoError(t, err)
		require.Len(t, retrieved, 0)
	})

	t.Run("returns the most recent cost center (by creation time)", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: 0,
			ForUsers: 500,
		})

		attributionID := uuid.New().String()
		firstCreation := time.Date(2022, 10, 10, 10, 10, 10, 10, time.UTC)
		secondCreation := firstCreation.Add(24 * time.Hour)

		costCenters := []db.CostCenter{
			dbtest.NewCostCenter(t, db.CostCenter{
				ID:              db.NewTeamAttributionID(attributionID),
				SpendingLimit:   100,
				CreationTime:    db.NewVarcharTime(firstCreation),
				BillingStrategy: db.CostCenter_Other,
				NextBillingTime: db.NewVarcharTime(firstCreation),
			}),
			dbtest.NewCostCenter(t, db.CostCenter{
				ID:              db.NewTeamAttributionID(attributionID),
				SpendingLimit:   100,
				CreationTime:    db.NewVarcharTime(secondCreation),
				BillingStrategy: db.CostCenter_Other,
				NextBillingTime: db.NewVarcharTime(secondCreation),
			}),
		}

		dbtest.CreateCostCenters(t, conn, costCenters...)

		retrieved, err := mnr.ListLatestCostCentersWithBillingTimeBefore(context.Background(), db.CostCenter_Other, secondCreation.Add(7*24*time.Hour))
		require.NoError(t, err)
		require.Len(t, retrieved, 1)

		requireCostCenterEqual(t, costCenters[1], retrieved[0])
	})

	t.Run("returns results only when most recent cost center matches billing strategy", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: 0,
			ForUsers: 500,
		})

		attributionID := uuid.New().String()
		firstCreation := time.Date(2022, 10, 10, 10, 10, 10, 10, time.UTC)
		secondCreation := firstCreation.Add(24 * time.Hour)

		costCenters := []db.CostCenter{
			dbtest.NewCostCenter(t, db.CostCenter{
				ID:              db.NewTeamAttributionID(attributionID),
				SpendingLimit:   100,
				CreationTime:    db.NewVarcharTime(firstCreation),
				BillingStrategy: db.CostCenter_Other,
				NextBillingTime: db.NewVarcharTime(firstCreation),
			}),
			dbtest.NewCostCenter(t, db.CostCenter{
				ID:              db.NewTeamAttributionID(attributionID),
				SpendingLimit:   100,
				CreationTime:    db.NewVarcharTime(secondCreation),
				BillingStrategy: db.CostCenter_Stripe,
			}),
		}

		dbtest.CreateCostCenters(t, conn, costCenters...)

		retrieved, err := mnr.ListLatestCostCentersWithBillingTimeBefore(context.Background(), db.CostCenter_Other, secondCreation.Add(7*24*time.Hour))
		require.NoError(t, err)
		require.Len(t, retrieved, 0)
	})
}

func TestCostCenterManager_ResetUsage(t *testing.T) {
	now := time.Now().UTC()
	ts := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), now.Second(), 0, time.UTC)

	t.Run("errors when cost center is not Other", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: 0,
			ForUsers: 500,
		})
		_, err := mnr.ResetUsage(context.Background(), db.CostCenter{
			ID:              db.NewUserAttributionID(uuid.New().String()),
			CreationTime:    db.NewVarcharTime(time.Now()),
			SpendingLimit:   500,
			BillingStrategy: db.CostCenter_Stripe,
		})
		require.Error(t, err)
	})

	t.Run("resets for teams", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: 0,
			ForUsers: 500,
		})
		oldCC := db.CostCenter{
			ID:              db.NewTeamAttributionID(uuid.New().String()),
			CreationTime:    db.NewVarcharTime(time.Now()),
			SpendingLimit:   0,
			BillingStrategy: db.CostCenter_Other,
			NextBillingTime: db.NewVarcharTime(ts),
		}
		newCC, err := mnr.ResetUsage(context.Background(), oldCC)
		require.NoError(t, err)
		t.Cleanup(func() {
			conn.Model(&db.CostCenter{}).Delete(newCC)
		})

		require.Equal(t, oldCC.ID, newCC.ID)
		require.EqualValues(t, 0, newCC.SpendingLimit)
		require.Equal(t, db.CostCenter_Other, newCC.BillingStrategy)
		require.Equal(t, ts.AddDate(0, 1, 0), newCC.NextBillingTime.Time())

	})

}
