// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Project struct {
	ID       uuid.UUID      `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	Name     string         `gorm:"column:name;type:varchar;size:255;" json:"name"`
	CloneURL string         `gorm:"column:cloneUrl;type:varchar;size:255;" json:"cloneUrl"`
	Slug     sql.NullString `gorm:"column:slug;type:varchar;size:255;" json:"slug"`
	Settings datatypes.JSON `gorm:"column:settings;type:text;size:65535;" json:"settings"`

	AppInstallationID string `gorm:"column:appInstallationId;type:varchar;size:255;" json:"appInstallationId"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	LastModified time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	TeamID sql.NullString `gorm:"column:teamId;type:char;size:36;" json:"teamId"`
	UserID sql.NullString `gorm:"column:userId;type:char;size:36;" json:"userId"`

	MarkedDeleted bool `gorm:"column:markedDeleted;type:tinyint;default:0;" json:"markedDeleted"`
}

// TableName sets the insert table name for this struct type
func (d *Project) TableName() string {
	return "d_b_project"
}
