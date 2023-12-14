// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"

	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestCreateStripeCustomer(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	customer := db.StripeCustomer{
		StripeCustomerID: "cus_1234",
		AttributionID:    db.NewTeamAttributionID(uuid.New().String()),
		CreationTime:     db.NewVarCharTime(time.Now()),
	}
	t.Cleanup(func() {
		require.NoError(t, conn.Delete(&customer).Error)
	})

	require.NoError(t, db.CreateStripeCustomer(context.Background(), conn, customer))

	// second create should fail due to PK contstraint
	require.Error(t, db.CreateStripeCustomer(context.Background(), conn, customer))
}

func TestGetStripeCustomer(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	customers := dbtest.CreateStripeCustomers(t, conn, dbtest.NewStripeCustomer(t, db.StripeCustomer{}))
	customer := customers[0]

	retrieved, err := db.GetStripeCustomer(context.Background(), conn, customer.StripeCustomerID)
	require.NoError(t, err)
	require.Equal(t, customer.StripeCustomerID, retrieved.StripeCustomerID)
	require.Equal(t, customer.AttributionID, retrieved.AttributionID)
}

func TestGetStripeCustomer_NotFound_WhenNotExists(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	_, err := db.GetStripeCustomer(context.Background(), conn, "cus_12314141")
	require.Error(t, err)
	require.ErrorIs(t, err, db.ErrorNotFound)
}

func TestGetStripeCustomerByAttributionID_ReturnsLatestRecord(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	now := time.Now()

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	first := dbtest.NewStripeCustomer(t, db.StripeCustomer{
		AttributionID: attributionID,
		CreationTime:  db.NewVarCharTime(now.Add(-1 * time.Hour)),
	})
	second := dbtest.NewStripeCustomer(t, db.StripeCustomer{
		AttributionID: attributionID,
		CreationTime:  db.NewVarCharTime(now),
	})
	dbtest.CreateStripeCustomers(t, conn, first, second)

	retrieved, err := db.GetStripeCustomerByAttributionID(context.Background(), conn, attributionID)
	require.NoError(t, err)
	require.Equal(t, second.StripeCustomerID, retrieved.StripeCustomerID)
	require.Equal(t, second.AttributionID, retrieved.AttributionID)
}

func TestGetStripeCustomerByAttributionID_NotFound_WhenNotExists(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	_, err := db.GetStripeCustomerByAttributionID(context.Background(), conn, attributionID)
	require.Error(t, err)
	require.ErrorIs(t, err, db.ErrorNotFound)
}
