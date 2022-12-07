// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestVarcharTime_SerializeAndDeserialize(t *testing.T) {
	// Custom table to be able to exercise serialization easily, independent of other models
	type VarcharModel struct {
		ID   int            `gorm:"primaryKey"`
		Time db.VarcharTime `gorm:"column:time;type:varchar(255);"`
	}

	conn := dbtest.ConnectForTests(t)
	require.NoError(t, conn.AutoMigrate(&VarcharModel{}))

	conn.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&VarcharModel{})

	for _, scenario := range []struct {
		Description string
		Input       VarcharModel
		Expected    VarcharModel
	}{
		{
			Description: "empty value for VarcharTime",
			Input: VarcharModel{
				ID:   1,
				Time: db.VarcharTime{},
			},
			Expected: VarcharModel{
				ID:   1,
				Time: db.VarcharTime{},
			},
		},
	} {
		tx := conn.Create(scenario.Input)
		require.NoError(t, tx.Error)

		var read VarcharModel
		tx = conn.First(&read, scenario.Input.ID)
		require.NoError(t, tx.Error)

		require.Equal(t, scenario.Expected, read)
	}
}
