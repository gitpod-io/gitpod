// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"context"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"testing"
	"time"
)

func NewOIDCClientConfig(t *testing.T, record db.OIDCClientConfig) db.OIDCClientConfig {
	t.Helper()

	cipher, _ := GetTestCipher(t)
	encrypted, err := db.EncryptJSON(cipher, db.OIDCSpec{})
	require.NoError(t, err)

	now := time.Now().UTC().Truncate(time.Millisecond)
	result := db.OIDCClientConfig{
		ID:           uuid.New(),
		Issuer:       "issuer",
		Data:         encrypted,
		LastModified: now,
	}

	if record.ID != uuid.Nil {
		result.ID = record.ID
	}

	if record.Issuer != "" {
		result.Issuer = record.Issuer
	}

	if record.Data != nil {
		result.Data = record.Data
	}

	return result
}

func CreateOIDCClientConfigs(t *testing.T, conn *gorm.DB, entries ...db.OIDCClientConfig) []db.OIDCClientConfig {
	t.Helper()

	var records []db.OIDCClientConfig
	var ids []string
	for _, entry := range entries {
		record := NewOIDCClientConfig(t, entry)
		records = append(records, record)
		ids = append(ids, record.ID.String())

		_, err := db.CreateOIDCCLientConfig(context.Background(), conn, record)
		require.NoError(t, err)
	}

	t.Cleanup(func() {
		if len(ids) > 0 {
			require.NoError(t, conn.Where(ids).Delete(&db.OIDCClientConfig{}).Error)
		}
	})

	return records
}
