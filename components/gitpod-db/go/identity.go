// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import "github.com/google/uuid"

type Identity struct {
	AuthProviderID string `gorm:"primary_key;column:authProviderId;type:char;size:255;not null;"`
	AuthID         string `gorm:"primary_key;column:authId;type:char;size:255;not null;"`

	AuthName string `gorm:"column:authName;type:char;size:255;not null;"`

	UserID       uuid.UUID `gorm:"column:userId;type:char;size:36;"`
	PrimaryEmail string    `gorm:"column:primaryEmail;type:char;size:255;not null;default:'';"`

	Deleted  bool `gorm:"column:deleted;type:tinyint;default:0;"`
	Readonly bool `gorm:"column:readonly;type:tinyint;default:0;"`
}

func (i *Identity) TableName() string {
	return "d_b_identity"
}
