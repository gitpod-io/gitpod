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

func NewOIDCClientConfig(t *testing.T, record db.OIDCClientConfig) db.OIDCClientConfig {
	t.Helper()

	cipher, _ := GetTestCipher(t)
	encrypted, err := db.EncryptJSON(cipher, db.OIDCSpec{
		ClientID:     "oidc-client-id",
		ClientSecret: "oidc-client-secret",
		RedirectURL:  "https://some-redirect-url.or/not",
		Scopes: []string{
			"aint", "never", "gonna", "give", "you", "up",
		},
	})
	require.NoError(t, err)

	now := time.Now().UTC().Truncate(time.Millisecond)
	result := db.OIDCClientConfig{
		ID:             uuid.New(),
		OrganizationID: uuid.New(),
		Issuer:         "https://accounts.google.com",
		Data:           encrypted,
		LastModified:   now,
		Active:         false,
		Verified:       db.BoolPointer(false),
	}

	if record.ID != uuid.Nil {
		result.ID = record.ID
	}

	if record.OrganizationID != uuid.Nil {
		result.OrganizationID = record.OrganizationID
	}

	if record.Issuer != "" {
		result.Issuer = record.Issuer
	}

	if record.Data != nil {
		result.Data = record.Data
	}

	if record.Active {
		result.Active = true
	}

	if record.Verified != nil && *record.Verified {
		result.Verified = db.BoolPointer(true)
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

		foo, err := db.CreateOIDCClientConfig(context.Background(), conn, record)
		require.NoError(t, err)
		require.NotNil(t, foo)
	}

	t.Cleanup(func() {
		HardDeleteOIDCClientConfigs(t, ids...)
	})

	return records
}

func HardDeleteOIDCClientConfigs(t *testing.T, ids ...string) {
	if len(ids) > 0 {
		require.NoError(t, conn.Where(ids).Delete(&db.OIDCClientConfig{}).Error)
	}
}
