// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"time"

	common_db "github.com/gitpod-io/gitpod/common-go/db"
	"github.com/google/uuid"
)

type Team struct {
	ID   uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	Name string    `gorm:"column:name;type:varchar;size:255;" json:"name"`
	Slug string    `gorm:"column:slug;type:varchar;size:255;" json:"slug"`

	CreationTime common_db.VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	LastModified time.Time             `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	MarkedDeleted bool `gorm:"column:markedDeleted;type:tinyint;default:0;" json:"marked_deleted"`

	// deleted is reserved for use by db-sync.
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *Team) TableName() string {
	return "d_b_team"
}
