// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestCostCenter_WriteRead(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	costCenter := &db.CostCenter{
		ID:            db.NewTeamAttributionID(uuid.New().String()),
		SpendingLimit: 100,
	}

	tx := conn.Create(costCenter)
	require.NoError(t, tx.Error)

	read := &db.CostCenter{ID: costCenter.ID}
	tx = conn.First(read)
	require.NoError(t, tx.Error)
	require.Equal(t, costCenter.ID, read.ID)
	require.Equal(t, costCenter.SpendingLimit, read.SpendingLimit)

	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(costCenter)
	})
}

func TestGetCostCenter(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	costCenter := &db.CostCenter{
		ID:            db.NewTeamAttributionID(uuid.New().String()),
		SpendingLimit: 300,
	}

	require.NoError(t, conn.Create(costCenter).Error)

	results, err := db.GetCostCenter(context.Background(), conn, costCenter.ID)

	require.NoError(t, err)
	require.Equal(t, costCenter.ID, results.ID)

	t.Cleanup(func() {
		conn.Model(&db.CostCenter{}).Delete(costCenter)
	})
}
