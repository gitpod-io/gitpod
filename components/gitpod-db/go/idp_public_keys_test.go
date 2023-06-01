// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCreateIDPPublicKey(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	created := dbtest.CreateIDPPublicKeys(t, conn, db.IDPPublicKey{KeyID: "test-1", Data: "test-data"})[0]

	retrieved, err := db.GetIDPPublicKey(context.Background(), conn, created.KeyID)
	require.NoError(t, err)
	require.Equal(t, created, retrieved)
}

func TestListActiveIDPPublicKeys(t *testing.T) {
	ctx := context.Background()
	conn := dbtest.ConnectForTests(t)

	dbtest.CreateIDPPublicKeys(t, conn,
		dbtest.NewIDPPublicKey(t, db.IDPPublicKey{
			KeyID:          "key-1",
			Data:           "data-1",
			LastActiveTime: time.Now().Add(-62 * time.Minute),
		}),
		dbtest.NewIDPPublicKey(t, db.IDPPublicKey{
			KeyID:          "key-2",
			Data:           "data-2",
			LastActiveTime: time.Now().Add(-30 * time.Minute),
		}),
		dbtest.NewIDPPublicKey(t, db.IDPPublicKey{
			KeyID:          "key-3",
			Data:           "data-3",
			LastActiveTime: time.Now(),
		}),
	)

	publicKeys, err := db.ListActiveIDPPublicKeys(ctx, conn)
	require.NoError(t, err)
	require.Len(t, publicKeys, 2)
}

func TestDeleteExpiredIDPPublicKeys(t *testing.T) {
	t.Run("marks record deleted", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		created := dbtest.CreateIDPPublicKeys(t, conn,
			dbtest.NewIDPPublicKey(t, db.IDPPublicKey{
				KeyID:          "key-1",
				Data:           "data-1",
				LastActiveTime: time.Now().Add(-62 * time.Minute),
			}),
			dbtest.NewIDPPublicKey(t, db.IDPPublicKey{
				KeyID:          "key-2",
				Data:           "data-2",
				LastActiveTime: time.Now().Add(-30 * time.Minute),
			}),
			dbtest.NewIDPPublicKey(t, db.IDPPublicKey{
				KeyID:          "key-3",
				Data:           "data-3",
				LastActiveTime: time.Now(),
			}),
		)

		err := db.DeleteExpiredIDPPublicKeys(context.Background(), conn)
		require.NoError(t, err)

		var retrieved db.IDPPublicKey
		tx := conn.Where("kid = ?", created[0].KeyID).First(&retrieved)
		require.ErrorIs(t, tx.Error, gorm.ErrRecordNotFound)
	})

}

func TestActivateIDPPublicKey(t *testing.T) {
	t.Run("not found when idp public key does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		err := db.MarkIDPPublicKeyActive(context.Background(), conn, "test-1")
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("public key which exists is marked as active", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		lastActiveTime := time.Now().UTC().Add(-10 * time.Minute).Truncate(time.Microsecond)
		publicKey := dbtest.CreateIDPPublicKeys(t, conn, db.IDPPublicKey{
			KeyID:          "key-1",
			Data:           "data-1",
			LastActiveTime: lastActiveTime,
		})[0]
		keyId := publicKey.KeyID

		k, err := db.GetIDPPublicKey(context.Background(), conn, keyId)
		require.NoError(t, err)
		require.Equal(t, lastActiveTime, k.LastActiveTime)

		err = db.MarkIDPPublicKeyActive(context.Background(), conn, keyId)
		require.NoError(t, err)

		k, err = db.GetIDPPublicKey(context.Background(), conn, keyId)
		require.NoError(t, err)
		require.Greater(t, 10, int(time.Since(k.LastActiveTime).Seconds()))
	})
}
