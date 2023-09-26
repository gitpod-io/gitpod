// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"sync"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"

	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
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

func TestCostCenterManager_GetOrCreateCostCenter_concurrent(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
		ForTeams: 0,
		ForUsers: 500,
	})
	id := db.NewTeamAttributionID(uuid.New().String())
	cleanUp(t, conn, id)

	waitgroup := &sync.WaitGroup{}
	save := func() {
		_, err := mnr.GetOrCreateCostCenter(context.Background(), id)
		require.NoError(t, err)
		waitgroup.Done()
	}
	waitgroup.Add(10)
	for i := 0; i < 10; i++ {
		go save()
	}
	waitgroup.Wait()
}

func TestCostCenterManager_GetOrCreateCostCenter(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
		ForTeams: 0,
		ForUsers: 500,
	})
	team := db.NewTeamAttributionID(uuid.New().String())
	cleanUp(t, conn, team)

	teamCC, err := mnr.GetOrCreateCostCenter(context.Background(), team)
	require.NoError(t, err)
	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(teamCC)
	})
	require.Equal(t, int32(0), teamCC.SpendingLimit)
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
		ID:                db.NewTeamAttributionID(uuid.New().String()),
		CreationTime:      db.NewVarCharTime(now),
		SpendingLimit:     0,
		BillingStrategy:   db.CostCenter_Other,
		NextBillingTime:   db.NewVarCharTime(expired),
		BillingCycleStart: db.NewVarCharTime(now),
	}
	unexpiredCC := db.CostCenter{
		ID:                db.NewTeamAttributionID(uuid.New().String()),
		CreationTime:      db.NewVarCharTime(now),
		SpendingLimit:     500,
		BillingStrategy:   db.CostCenter_Other,
		NextBillingTime:   db.NewVarCharTime(unexpired),
		BillingCycleStart: db.NewVarCharTime(now),
	}
	// Stripe billing strategy should not be reset
	stripeCC := db.CostCenter{
		ID:                db.NewTeamAttributionID(uuid.New().String()),
		CreationTime:      db.NewVarCharTime(now),
		SpendingLimit:     0,
		BillingStrategy:   db.CostCenter_Stripe,
		NextBillingTime:   db.VarcharTime{},
		BillingCycleStart: db.NewVarCharTime(now),
	}

	dbtest.CreateCostCenters(t, conn,
		dbtest.NewCostCenter(t, expiredCC),
		dbtest.NewCostCenter(t, unexpiredCC),
		dbtest.NewCostCenter(t, stripeCC),
	)

	// expired db.CostCenter should be reset, so we get a new CreationTime
	retrievedExpiredCC, err := mnr.GetOrCreateCostCenter(context.Background(), expiredCC.ID)
	require.NoError(t, err)
	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(retrievedExpiredCC.ID)
	})
	require.Equal(t, db.NewVarCharTime(expired).Time().AddDate(0, 1, 0), retrievedExpiredCC.NextBillingTime.Time())
	require.Equal(t, expiredCC.ID, retrievedExpiredCC.ID)
	require.Equal(t, expiredCC.BillingStrategy, retrievedExpiredCC.BillingStrategy)
	require.WithinDuration(t, now, expiredCC.CreationTime.Time(), 3*time.Second, "new cost center creation time must be within 3 seconds of now")

	// unexpired cost center must not be reset
	retrievedUnexpiredCC, err := mnr.GetOrCreateCostCenter(context.Background(), unexpiredCC.ID)
	require.NoError(t, err)
	require.Equal(t, db.NewVarCharTime(unexpired).Time(), retrievedUnexpiredCC.NextBillingTime.Time())
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
		teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
		cleanUp(t, conn, teamAttributionID)

		_, err := mnr.UpdateCostCenter(context.Background(), db.CostCenter{
			ID:              teamAttributionID,
			BillingStrategy: db.CostCenter_Stripe,
			SpendingLimit:   -1,
		})
		require.Error(t, err)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
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

	t.Run("increment billing cycle should always increment to now", func(t *testing.T) {
		mnr := db.NewCostCenterManager(conn, limits)
		teamAttributionID := db.NewTeamAttributionID(uuid.New().String())
		cleanUp(t, conn, teamAttributionID)

		res, err := mnr.GetOrCreateCostCenter(context.Background(), teamAttributionID)
		require.NoError(t, err)

		// set res.nextBillingTime to two months ago
		res.NextBillingTime = db.NewVarCharTime(time.Now().AddDate(0, -2, 0))
		conn.Save(res)

		cc, err := mnr.IncrementBillingCycle(context.Background(), teamAttributionID)
		require.NoError(t, err)

		require.True(t, cc.NextBillingTime.Time().After(time.Now()), "The next billing time should be in the future")
		require.True(t, cc.BillingCycleStart.Time().Before(time.Now()), "The next billing time should be in the future")
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
	require.Equal(t, teamCC.CreationTime.Time().AddDate(0, 1, 0), teamCC.NextBillingTime.Time())
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

		retrieved, err := mnr.ListManagedCostCentersWithBillingTimeBefore(context.Background(), ts.Add(7*24*time.Hour))
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
				CreationTime:    db.NewVarCharTime(firstCreation),
				BillingStrategy: db.CostCenter_Other,
				NextBillingTime: db.NewVarCharTime(firstCreation),
			}),
			dbtest.NewCostCenter(t, db.CostCenter{
				ID:              db.NewTeamAttributionID(attributionID),
				SpendingLimit:   100,
				CreationTime:    db.NewVarCharTime(secondCreation),
				BillingStrategy: db.CostCenter_Other,
				NextBillingTime: db.NewVarCharTime(secondCreation),
			}),
		}

		dbtest.CreateCostCenters(t, conn, costCenters...)

		retrieved, err := mnr.ListManagedCostCentersWithBillingTimeBefore(context.Background(), secondCreation.Add(7*24*time.Hour))
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
				CreationTime:    db.NewVarCharTime(firstCreation),
				BillingStrategy: db.CostCenter_Other,
				NextBillingTime: db.NewVarCharTime(firstCreation),
			}),
			dbtest.NewCostCenter(t, db.CostCenter{
				ID:              db.NewTeamAttributionID(attributionID),
				SpendingLimit:   100,
				CreationTime:    db.NewVarCharTime(secondCreation),
				BillingStrategy: db.CostCenter_Stripe,
			}),
		}

		dbtest.CreateCostCenters(t, conn, costCenters...)

		retrieved, err := mnr.ListManagedCostCentersWithBillingTimeBefore(context.Background(), secondCreation.Add(7*24*time.Hour))
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
		cc := dbtest.CreateCostCenters(t, conn, db.CostCenter{
			ID:              db.NewTeamAttributionID(uuid.New().String()),
			CreationTime:    db.NewVarCharTime(time.Now()),
			SpendingLimit:   500,
			BillingStrategy: db.CostCenter_Stripe,
		})[0]

		_, err := mnr.ResetUsage(context.Background(), cc.ID)
		require.Error(t, err)
	})

	t.Run("resets for teams", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: 0,
			ForUsers: 500,
		})
		oldCC := dbtest.CreateCostCenters(t, conn, db.CostCenter{
			ID:                db.NewTeamAttributionID(uuid.New().String()),
			CreationTime:      db.NewVarCharTime(time.Now()),
			SpendingLimit:     10,
			BillingStrategy:   db.CostCenter_Other,
			NextBillingTime:   db.NewVarCharTime(ts),
			BillingCycleStart: db.NewVarCharTime(ts.AddDate(0, -1, 0)),
		})[0]
		newCC, err := mnr.ResetUsage(context.Background(), oldCC.ID)
		require.NoError(t, err)
		require.Equal(t, oldCC.ID, newCC.ID)
		require.EqualValues(t, 10, newCC.SpendingLimit)
		require.Equal(t, db.CostCenter_Other, newCC.BillingStrategy)
		require.Equal(t, db.NewVarCharTime(ts.AddDate(0, 1, 0)).Time(), newCC.NextBillingTime.Time())

	})

	t.Run("transitioning from stripe back to other restores previous limit", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: 0,
			ForUsers: 500,
		})
		var originalSpendingLimit int32 = 10
		cc := dbtest.CreateCostCenters(t, conn, db.CostCenter{
			ID:                db.NewTeamAttributionID(uuid.New().String()),
			CreationTime:      db.NewVarCharTime(time.Now()),
			SpendingLimit:     originalSpendingLimit,
			BillingStrategy:   db.CostCenter_Other,
			NextBillingTime:   db.NewVarCharTime(ts),
			BillingCycleStart: db.NewVarCharTime(ts.AddDate(0, -1, 0)),
		})[0]
		cc.BillingStrategy = db.CostCenter_Stripe
		_, err := mnr.UpdateCostCenter(context.Background(), cc)
		require.NoError(t, err)
		// change spending limit
		cc.SpendingLimit = int32(20)
		_, err = mnr.UpdateCostCenter(context.Background(), cc)
		require.NoError(t, err)

		cc, err = mnr.GetOrCreateCostCenter(context.Background(), cc.ID)
		require.NoError(t, err)
		require.Equal(t, int32(20), cc.SpendingLimit)

		// change to other strategy again and verify the original limit is restored
		cc.BillingStrategy = db.CostCenter_Other
		cc, err = mnr.UpdateCostCenter(context.Background(), cc)
		require.NoError(t, err)
		require.Equal(t, originalSpendingLimit, cc.SpendingLimit)
	})

	t.Run("users get free credits only once for the first org", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		limitForUsers := int32(500)
		limitForTeams := int32(0)
		mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
			ForTeams: limitForTeams,
			ForUsers: limitForUsers,
		})
		createMembership := func(t *testing.T, anOrgID string, aUserID string) {
			memberShipID := uuid.New().String()
			db := conn.Exec(`INSERT INTO d_b_team_membership (id, teamid, userid, role, creationtime) VALUES (?, ?, ?, ?, ?)`,
				memberShipID,
				anOrgID,
				aUserID,
				"owner",
				db.TimeToISO8601(time.Now()))
			require.NoError(t, db.Error)
			t.Cleanup(func() {
				conn.Exec(`DELETE FROM d_b_team_membership WHERE id = ?`, memberShipID)
			})
		}

		orgID := uuid.New().String()
		orgID2 := uuid.New().String()
		userID := uuid.New().String()
		t.Cleanup(func() {
			conn.Exec(`DELETE FROM d_b_free_credits WHERE userId = ?`, userID)
		})
		createMembership(t, orgID, userID)
		createMembership(t, orgID2, userID)
		cc1, err := mnr.GetOrCreateCostCenter(context.Background(), db.NewTeamAttributionID(orgID))
		require.NoError(t, err)
		cc2, err := mnr.GetOrCreateCostCenter(context.Background(), db.NewTeamAttributionID(orgID2))
		require.NoError(t, err)
		require.Equal(t, limitForUsers, cc1.SpendingLimit)
		require.Equal(t, limitForTeams, cc2.SpendingLimit)
	})

}
