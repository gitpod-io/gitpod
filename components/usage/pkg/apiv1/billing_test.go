// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestBalancesForStripeCostCenters(t *testing.T) {
	attributionIDForStripe := db.NewUserAttributionID(uuid.New().String())
	attributionIDForOther := db.NewTeamAttributionID(uuid.New().String())
	dbconn := dbtest.ConnectForTests(t)

	dbtest.CreateCostCenters(t, dbconn,
		dbtest.NewCostCenter(t, db.CostCenter{
			ID:              attributionIDForStripe,
			BillingStrategy: db.CostCenter_Stripe,
		}),
		dbtest.NewCostCenter(t, db.CostCenter{
			ID:              attributionIDForOther,
			BillingStrategy: db.CostCenter_Other,
		}),
	)

	balances := []db.Balance{
		{
			AttributionID: attributionIDForStripe,
			CreditCents:   100,
		},
		{
			AttributionID: attributionIDForOther,
			CreditCents:   100,
		},
	}

	stripeBalances, err := balancesForStripeCostCenters(context.Background(), db.NewCostCenterManager(dbconn, db.DefaultSpendingLimit{}), balances)
	require.NoError(t, err)
	require.Len(t, stripeBalances, 1)
	require.Equal(t, stripeBalances[0].AttributionID, attributionIDForStripe)
}
