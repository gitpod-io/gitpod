// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
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

func NewUser(t *testing.T, user db.User) db.User {
	t.Helper()

	orgID := uuid.New()

	userID := uuid.New()
	result := db.User{
		ID:                 userID,
		OrganizationID:     &orgID,
		UsageAttributionID: db.NewTeamAttributionID(uuid.NewString()),

		Name:      "HomerJSimpson",
		FullName:  "Homer Simpson",
		AvatarURL: "https://avatars.githubusercontent.com/u/9071",

		CreationDate: db.NewVarCharTime(time.Now().Round(time.Second)),

		Identities: []db.Identity{
			NewIdentity(t, db.Identity{
				UserID: userID,
			}),
		},
	}

	if user.ID != uuid.Nil {
		result.ID = user.ID
	}
	if user.OrganizationID != nil {
		result.OrganizationID = user.OrganizationID
	}
	if user.UsageAttributionID != "" {
		result.UsageAttributionID = user.UsageAttributionID
	}

	if user.AvatarURL != "" {
		result.AvatarURL = user.AvatarURL
	}
	if user.Name != "" {
		result.Name = user.Name
	}
	if user.FullName != "" {
		result.FullName = user.FullName
	}

	return result
}

func CreatUsers(t *testing.T, conn *gorm.DB, user ...db.User) []db.User {
	t.Helper()

	var records []db.User
	var ids []uuid.UUID
	for _, u := range user {
		record := NewUser(t, u)
		records = append(records, record)
		ids = append(ids, record.ID)
	}

	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		if len(ids) > 0 {
			require.NoError(t, conn.Where(ids).Delete(&db.User{}).Error)
		}
	})

	return records
}
