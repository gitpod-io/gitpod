// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"database/sql"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"time"
)

type WorkspaceInstance struct {
	ID                 uuid.UUID      `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	WorkspaceID        string         `gorm:"column:workspaceId;type:char;size:36;" json:"workspaceId"`
	Configuration      datatypes.JSON `gorm:"column:configuration;type:text;size:65535;" json:"configuration"`
	Region             string         `gorm:"column:region;type:varchar;size:255;" json:"region"`
	ImageBuildInfo     sql.NullString `gorm:"column:imageBuildInfo;type:text;size:65535;" json:"imageBuildInfo"`
	IdeURL             string         `gorm:"column:ideUrl;type:varchar;size:255;" json:"ideUrl"`
	WorkspaceBaseImage string         `gorm:"column:workspaceBaseImage;type:varchar;size:255;" json:"workspaceBaseImage"`
	WorkspaceImage     string         `gorm:"column:workspaceImage;type:varchar;size:255;" json:"workspaceImage"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	StartedTime  VarcharTime `gorm:"column:startedTime;type:varchar;size:255;" json:"startedTime"`
	DeployedTime VarcharTime `gorm:"column:deployedTime;type:varchar;size:255;" json:"deployedTime"`
	StoppedTime  VarcharTime `gorm:"column:stoppedTime;type:varchar;size:255;" json:"stoppedTime"`
	LastModified time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
	StoppingTime VarcharTime `gorm:"column:stoppingTime;type:varchar;size:255;" json:"stoppingTime"`

	LastHeartbeat  string         `gorm:"column:lastHeartbeat;type:varchar;size:255;" json:"lastHeartbeat"`
	StatusOld      sql.NullString `gorm:"column:status_old;type:varchar;size:255;" json:"status_old"`
	Status         datatypes.JSON `gorm:"column:status;type:json;" json:"status"`
	Phase          sql.NullString `gorm:"column:phase;type:char;size:32;" json:"phase"`
	PhasePersisted string         `gorm:"column:phasePersisted;type:char;size:32;" json:"phasePersisted"`

	// deleted is restricted for use by db-sync
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *WorkspaceInstance) TableName() string {
	return "d_b_workspace_instance"
}
