// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"database/sql"
	"gorm.io/datatypes"
	"time"
)

// Workspace represents the underlying DB object
type Workspace struct {
	ID          string         `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	OwnerID     string         `gorm:"column:ownerId;type:char;size:36;" json:"ownerId"`
	ProjectID   sql.NullString `gorm:"column:projectId;type:char;size:36;" json:"projectId"`
	Description string         `gorm:"column:description;type:varchar;size:255;" json:"description"`
	Type        string         `gorm:"column:type;type:char;size:16;default:regular;" json:"type"`
	CloneURL    string         `gorm:"column:cloneURL;type:varchar;size:255;" json:"cloneURL"`

	ContextURL            string         `gorm:"column:contextURL;type:text;size:65535;" json:"contextURL"`
	Context               datatypes.JSON `gorm:"column:context;type:text;size:65535;" json:"context"`
	Config                datatypes.JSON `gorm:"column:config;type:text;size:65535;" json:"config"`
	BasedOnPrebuildID     sql.NullString `gorm:"column:basedOnPrebuildId;type:char;size:36;" json:"basedOnPrebuildId"`
	BasedOnSnapshotID     sql.NullString `gorm:"column:basedOnSnapshotId;type:char;size:36;" json:"basedOnSnapshotId"`
	ImageSource           datatypes.JSON `gorm:"column:imageSource;type:text;size:65535;" json:"imageSource"`
	ImageNameResolved     string         `gorm:"column:imageNameResolved;type:varchar;size:255;" json:"imageNameResolved"`
	BaseImageNameResolved string         `gorm:"column:baseImageNameResolved;type:varchar;size:255;" json:"baseImageNameResolved"`

	CreationTime       VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	LastModified       time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
	SoftDeletedTime    VarcharTime `gorm:"column:softDeletedTime;type:varchar;size:255;" json:"softDeletedTime"`
	ContentDeletedTime VarcharTime `gorm:"column:contentDeletedTime;type:varchar;size:255;" json:"contentDeletedTime"`

	Archived  int32 `gorm:"column:archived;type:tinyint;default:0;" json:"archived"`
	Shareable int32 `gorm:"column:shareable;type:tinyint;default:0;" json:"shareable"`

	SoftDeleted sql.NullString `gorm:"column:softDeleted;type:char;size:4;" json:"softDeleted"`
	Pinned      int32          `gorm:"column:pinned;type:tinyint;default:0;" json:"pinned"`

	// deleted is reserved for use by db-sync
	_ int32 `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

func (d *Workspace) TableName() string {
	return "d_b_workspace"
}
