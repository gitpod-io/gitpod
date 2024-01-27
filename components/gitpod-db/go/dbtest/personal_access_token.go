// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"context"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func NewPersonalAccessToken(t *testing.T, record db.PersonalAccessToken) db.PersonalAccessToken {
	t.Helper()

	now := time.Now().UTC().Round(time.Millisecond)
	tokenID := uuid.New()

	result := db.PersonalAccessToken{
		ID:             tokenID,
		UserID:         uuid.New(),
		Hash:           "some-secure-hash",
		Name:           "some-name",
		Scopes:         []string{"resource:default", "function:*"},
		ExpirationTime: now.Add(5 * time.Hour),
		CreatedAt:      now,
		LastModified:   now,
	}

	if record.ID != uuid.Nil {
		result.ID = record.ID
	}

	if record.UserID != uuid.Nil {
		result.UserID = record.UserID
	}

	if record.Hash != "" {
		result.Hash = record.Hash
	}

	if record.Name != "" {
		result.Name = record.Name
	}

	if len(record.Scopes) == 0 {
		result.Scopes = record.Scopes
	}

	if !record.ExpirationTime.IsZero() {
		result.ExpirationTime = record.ExpirationTime
	}

	if !record.CreatedAt.IsZero() {
		result.CreatedAt = record.CreatedAt
	}

	if !record.LastModified.IsZero() {
		result.LastModified = record.LastModified
	}

	return result
}

func CreatePersonalAccessTokenRecords(t *testing.T, conn *gorm.DB, entries ...db.PersonalAccessToken) []db.PersonalAccessToken {
	t.Helper()

	var records []db.PersonalAccessToken
	var ids []string
	for _, tokenEntry := range entries {
		record := NewPersonalAccessToken(t, tokenEntry)
		records = append(records, record)
		ids = append(ids, record.ID.String())

		_, err := db.CreatePersonalAccessToken(context.Background(), conn, tokenEntry)
		require.NoError(t, err)
	}

	t.Cleanup(func() {
		if len(ids) > 0 {
			require.NoError(t, conn.Where(ids).Delete(&db.PersonalAccessToken{}).Error)
		}
	})

	return records
}
