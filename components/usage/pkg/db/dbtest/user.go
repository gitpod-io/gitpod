// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbtest

import (
	"testing"
	"time"

	common_db "github.com/gitpod-io/gitpod/common-go/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID             `gorm:"primary_key;column:id;type:char;size:36;"`
	AvatarURL    string                `gorm:"column:avatarUrl;type:char;size:255;"`
	Name         string                `gorm:"column:name;type:char;size:255;"`
	FullName     string                `gorm:"column:fullName;type:char;size:255;"`
	CreationDate common_db.VarcharTime `gorm:"column:creationDate;type:varchar;size:255;"`

	// user has more field but we don't care here as they are just used in tests.
}

func (user *User) TableName() string {
	return "d_b_user"
}

func NewUser(t *testing.T, user User) User {
	t.Helper()

	result := User{
		ID:           uuid.New(),
		AvatarURL:    "https://avatars.githubusercontent.com/u/9071",
		Name:         "HomerJSimpson",
		FullName:     "Homer Simpson",
		CreationDate: common_db.NewVarCharTime(time.Now()),
	}

	if user.ID != uuid.Nil {
		result.ID = user.ID
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

func CreatUser(t *testing.T, conn *gorm.DB, user ...User) []User {
	t.Helper()

	var records []User
	var ids []uuid.UUID
	for _, u := range user {
		record := NewUser(t, u)
		records = append(records, record)
		ids = append(ids, record.ID)
	}

	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		require.NoError(t, conn.Where(ids).Delete(&User{}).Error)
	})

	return records
}
