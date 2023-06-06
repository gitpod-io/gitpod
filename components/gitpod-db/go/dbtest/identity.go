// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func NewIdentity(t *testing.T, idnt db.Identity) db.Identity {
	t.Helper()

	result := db.Identity{
		AuthProviderID: uuid.NewString(),
		AuthID:         uuid.NewString(),
		AuthName:       "unittest",
		UserID:         uuid.New(),
		PrimaryEmail:   "test-identity@gitpod.io",
	}

	if idnt.AuthProviderID != "" {
		result.AuthProviderID = idnt.AuthProviderID
	}
	if idnt.AuthID != "" {
		result.AuthID = idnt.AuthID
	}
	if idnt.AuthName != "" {
		result.AuthName = idnt.AuthName
	}
	if idnt.UserID != uuid.Nil {
		result.UserID = idnt.UserID
	}
	if idnt.PrimaryEmail != "" {
		result.PrimaryEmail = idnt.PrimaryEmail
	}

	return result
}

func CreateIdentities(t *testing.T, conn *gorm.DB, user ...db.Identity) []db.Identity {
	t.Helper()

	type tuple struct {
		AuthProviderID string
		AuthID         string
	}

	var records []db.Identity
	var ids []tuple
	for _, u := range user {
		record := NewIdentity(t, u)
		records = append(records, record)
		ids = append(ids, tuple{
			AuthProviderID: record.AuthProviderID,
			AuthID:         record.AuthID,
		})

	}
	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		for _, tup := range ids {
			require.NoError(t, conn.Where("authProviderId = ?", tup.AuthProviderID).Where("authId = ?", tup.AuthID).Delete(&db.User{}).Error)
		}
	})

	return records
}
