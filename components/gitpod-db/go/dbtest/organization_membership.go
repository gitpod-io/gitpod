// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func NewTeamMembership(t *testing.T, membership db.OrganizationMembership) db.OrganizationMembership {
	t.Helper()

	result := db.OrganizationMembership{
		ID:             uuid.New(),
		OrganizationID: uuid.New(),
		UserID:         uuid.New(),
		Role:           db.OrganizationMembershipRole_Member,
		CreationTime:   db.NewVarCharTime(time.Now()),
	}

	if membership.ID != uuid.Nil {
		result.ID = membership.ID
	}
	if membership.OrganizationID != uuid.Nil {
		result.OrganizationID = membership.OrganizationID
	}
	if membership.UserID != uuid.Nil {
		result.UserID = membership.UserID
	}
	if membership.Role != "" {
		result.Role = membership.Role
	}
	if membership.CreationTime.IsSet() {
		result.CreationTime = membership.CreationTime
	}

	return result
}

func CreateTeamMembership(t *testing.T, conn *gorm.DB, memberships ...db.OrganizationMembership) []db.OrganizationMembership {
	t.Helper()

	var records []db.OrganizationMembership
	var ids []uuid.UUID
	for _, m := range memberships {
		record := NewTeamMembership(t, m)
		records = append(records, record)
		ids = append(ids, record.ID)
	}

	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		if len(ids) > 0 {
			require.NoError(t, conn.Where(ids).Delete(db.OrganizationMembership{}).Error)
		}

	})

	return records
}
