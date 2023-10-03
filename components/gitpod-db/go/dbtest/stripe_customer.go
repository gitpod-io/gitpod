// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"fmt"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func NewStripeCustomer(t *testing.T, customer db.StripeCustomer) db.StripeCustomer {
	t.Helper()

	result := db.StripeCustomer{
		StripeCustomerID: fmt.Sprintf("cus_%s", uuid.New().String()),
		AttributionID:    db.NewTeamAttributionID(uuid.New().String()),
		CreationTime:     db.NewVarCharTime(time.Now()),
	}

	if customer.StripeCustomerID != "" {
		result.StripeCustomerID = customer.StripeCustomerID
	}

	if customer.AttributionID != "" {
		result.AttributionID = customer.AttributionID
	}
	if customer.CreationTime.IsSet() {
		result.CreationTime = customer.CreationTime
	}

	return result
}

func CreateStripeCustomers(t *testing.T, conn *gorm.DB, customers ...db.StripeCustomer) []db.StripeCustomer {
	t.Helper()

	var records []db.StripeCustomer
	var ids []string
	for _, c := range customers {
		record := NewStripeCustomer(t, c)
		records = append(records, record)
		ids = append(ids, record.StripeCustomerID)
	}

	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		require.NoError(t, conn.Where(ids).Delete(&db.StripeCustomer{}).Error)
	})

	return records
}
