// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"context"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func NewIDPPublicKey(t *testing.T, record db.IDPPublicKey) db.IDPPublicKey {
	t.Helper()

	now := time.Now().UTC().Truncate(time.Millisecond)
	result := db.IDPPublicKey{
		KeyID:          record.KeyID,
		Data:           record.Data,
		LastActiveTime: now,
		LastModified:   now,
	}
	if !record.LastActiveTime.IsZero() {
		result.LastActiveTime = record.LastActiveTime
	}
	return result
}

func CreateIDPPublicKeys(t *testing.T, conn *gorm.DB, entries ...db.IDPPublicKey) []db.IDPPublicKey {
	t.Helper()

	var records []db.IDPPublicKey
	var ids []string
	for _, entry := range entries {
		record := NewIDPPublicKey(t, entry)
		records = append(records, record)
		ids = append(ids, record.KeyID)

		foo, err := db.CreateIDPPublicKey(context.Background(), conn, record)
		require.NoError(t, err)
		require.NotNil(t, foo)
	}

	t.Cleanup(func() {
		HardDeleteIDPPublicKeys(t, ids...)
	})

	return records
}

func HardDeleteIDPPublicKeys(t *testing.T, ids ...string) {
	if len(ids) > 0 {
		require.NoError(t, conn.Where(ids).Delete(&db.IDPPublicKey{}).Error)
	}
}
