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

func TestCostCenterManager_UpdateCostCenter(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
		ForTeams: 0,
		ForUsers: 500,
	})
	team := db.NewTeamAttributionID(uuid.New().String())
	cleanUp(t, conn, team)
	teamCC, err := mnr.GetOrCreateCostCenter(context.Background(), team)
	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(teamCC)
	})
	require.NoError(t, err)
	require.Equal(t, int32(0), teamCC.SpendingLimit)

	teamCC.SpendingLimit = 2000
	teamCC, err = mnr.UpdateCostCenter(context.Background(), teamCC)
	require.NoError(t, err)
	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(teamCC)
	})
	require.Equal(t, int32(2000), teamCC.SpendingLimit)
}

func TestSaveCostCenterMovedToStripe(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	mnr := db.NewCostCenterManager(conn, db.DefaultSpendingLimit{
		ForTeams: 0,
		ForUsers: 500,
	})
	team := db.NewTeamAttributionID(uuid.New().String())
	cleanUp(t, conn, team)
	teamCC, err := mnr.GetOrCreateCostCenter(context.Background(), team)
	require.NoError(t, err)
	require.Equal(t, int32(0), teamCC.SpendingLimit)

	teamCC.BillingStrategy = db.CostCenter_Stripe
	newTeamCC, err := mnr.UpdateCostCenter(context.Background(), teamCC)
	require.NoError(t, err)
	require.Equal(t, db.CostCenter_Stripe, newTeamCC.BillingStrategy)
	require.Equal(t, newTeamCC.CreationTime.Time().AddDate(0, 1, 0).Truncate(time.Second), newTeamCC.NextBillingTime.Time().Truncate(time.Second))
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
