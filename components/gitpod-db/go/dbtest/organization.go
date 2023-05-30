// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"context"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func CreateOrganizations(t *testing.T, conn *gorm.DB, entries ...db.Organization) []db.Organization {
	t.Helper()

	var records []db.Organization
	var ids []string
	for _, entry := range entries {
		record := db.Organization{
			ID:   uuid.New(),
			Name: "Team1",
			Slug: "org-" + uuid.New().String(),
		}
		if entry.ID != uuid.Nil {
			record.ID = entry.ID
		}
		if entry.Name != "" {
			record.Name = entry.Name
		}
		if entry.Slug != "" {
			record.Slug = entry.Slug
		}
		records = append(records, record)
		ids = append(ids, record.ID.String())

		created, err := db.CreateOrganization(context.Background(), conn, record)
		require.NoError(t, err)
		require.NotNil(t, created)
	}

	t.Cleanup(func() {
		HardDeleteTeams(t, ids...)
	})

	return records
}

func HardDeleteTeams(t *testing.T, ids ...string) {
	if len(ids) > 0 {
		require.NoError(t, conn.Where(ids).Delete(&db.Organization{}).Error)
	}
}
