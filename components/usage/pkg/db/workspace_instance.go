// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
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
	UsageAttributionID AttributionID  `gorm:"column:usageAttributionId;type:varchar;size:60;" json:"usageAttributionId"`
	WorkspaceClass     string         `gorm:"column:workspaceClass;type:varchar;size:255;" json:"workspaceClass"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	StartedTime  VarcharTime `gorm:"column:startedTime;type:varchar;size:255;" json:"startedTime"`
	DeployedTime VarcharTime `gorm:"column:deployedTime;type:varchar;size:255;" json:"deployedTime"`
	StoppedTime  VarcharTime `gorm:"column:stoppedTime;type:varchar;size:255;" json:"stoppedTime"`
	LastModified time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
	StoppingTime VarcharTime `gorm:"column:stoppingTime;type:varchar;size:255;" json:"stoppingTime"`

	LastHeartbeat string         `gorm:"column:lastHeartbeat;type:varchar;size:255;" json:"lastHeartbeat"`
	StatusOld     sql.NullString `gorm:"column:status_old;type:varchar;size:255;" json:"status_old"`
	Status        datatypes.JSON `gorm:"column:status;type:json;" json:"status"`
	// Phase is derived from Status by extracting JSON from it. Read-only (-> property).
	Phase          sql.NullString `gorm:"->:column:phase;type:char;size:32;" json:"phase"`
	PhasePersisted string         `gorm:"column:phasePersisted;type:char;size:32;" json:"phasePersisted"`

	// deleted is restricted for use by db-sync
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (i *WorkspaceInstance) TableName() string {
	return "d_b_workspace_instance"
}

// ListWorkspaceInstancesInRange lists WorkspaceInstances between from (inclusive) and to (exclusive).
// This results in all instances which have existed in the specified period, regardless of their current status, this includes:
// - terminated
// - running
// - instances which only just terminated after the start period
// - instances which only just started in the period specified
func ListWorkspaceInstancesInRange(ctx context.Context, conn *gorm.DB, from, to time.Time) ([]WorkspaceInstanceForUsage, error) {
	var instances []WorkspaceInstanceForUsage
	var instancesInBatch []WorkspaceInstanceForUsage

	tx := conn.WithContext(ctx).
		Table(fmt.Sprintf("%s as wsi", (&WorkspaceInstance{}).TableName())).
		Select("wsi.id as id, "+
			"ws.projectId as projectId, "+
			"ws.type as workspaceType, "+
			"wsi.workspaceClass as workspaceClass, "+
			"wsi.usageAttributionId as usageAttributionId, "+
			"wsi.creationTime as creationTime, "+
			"wsi.startedTime as startedTime, "+
			"wsi.stoppingTime as stoppingTime, "+
			"wsi.stoppedTime as stoppedTime, "+
			"ws.ownerId as ownerId, "+
			"ws.id as workspaceId",
		).
		Joins(fmt.Sprintf("LEFT JOIN %s AS ws ON wsi.workspaceId = ws.id", (&Workspace{}).TableName())).
		Where(
			conn.Where("wsi.stoppingTime >= ?", TimeToISO8601(from)).Or("wsi.stoppingTime = ?", ""),
		).
		Where("wsi.startedTime != ?", "").
		Where("wsi.startedTime < ?", TimeToISO8601(to)).
		Where("wsi.usageAttributionId != ?", "").
		FindInBatches(&instancesInBatch, 1000, func(_ *gorm.DB, _ int) error {
			instances = append(instances, instancesInBatch...)
			return nil
		})
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to list workspace instances: %w", tx.Error)
	}

	return instances, nil
}

const (
	AttributionEntity_User = "user"
	AttributionEntity_Team = "team"
)

func newAttributionID(entity, identifier string) AttributionID {
	return AttributionID(fmt.Sprintf("%s:%s", entity, identifier))
}

func NewUserAttributionID(userID string) AttributionID {
	return newAttributionID(AttributionEntity_User, userID)
}

func NewTeamAttributionID(teamID string) AttributionID {
	return newAttributionID(AttributionEntity_Team, teamID)
}

// AttributionID consists of an entity, and an identifier in the form:
// <entity>:<identifier>, e.g. team:a7dcf253-f05e-4dcf-9a47-cf8fccc74717
type AttributionID string

func (a AttributionID) Values() (entity string, identifier string) {
	tokens := strings.Split(string(a), ":")
	if len(tokens) != 2 {
		return "", ""
	}

	return tokens[0], tokens[1]
}

func ParseAttributionID(s string) (AttributionID, error) {
	tokens := strings.Split(s, ":")
	if len(tokens) != 2 {
		return "", fmt.Errorf("attribution ID (%s) does not have two parts", s)
	}

	switch tokens[0] {
	case AttributionEntity_Team:
		return NewTeamAttributionID(tokens[1]), nil
	case AttributionEntity_User:
		return NewUserAttributionID(tokens[1]), nil
	default:
		return "", fmt.Errorf("unknown attribution ID type: %s", s)
	}
}

const (
	WorkspaceClass_Default = "default"
)

type WorkspaceInstanceForUsage struct {
	ID                 uuid.UUID      `gorm:"column:id;type:char;size:36;" json:"id"`
	WorkspaceID        string         `gorm:"column:workspaceId;type:char;size:36;" json:"workspaceId"`
	OwnerID            uuid.UUID      `gorm:"column:ownerId;type:char;size:36;" json:"ownerId"`
	ProjectID          sql.NullString `gorm:"column:projectId;type:char;size:36;" json:"projectId"`
	WorkspaceClass     string         `gorm:"column:workspaceClass;type:varchar;size:255;" json:"workspaceClass"`
	Type               WorkspaceType  `gorm:"column:workspaceType;type:char;size:16;default:regular;" json:"workspaceType"`
	UsageAttributionID AttributionID  `gorm:"column:usageAttributionId;type:varchar;size:60;" json:"usageAttributionId"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	StartedTime  VarcharTime `gorm:"column:startedTime;type:varchar;size:255;" json:"startedTime"`
	StoppingTime VarcharTime `gorm:"column:stoppingTime;type:varchar;size:255;" json:"stoppingTime"`
	StoppedTime  VarcharTime `gorm:"column:stoppedTime;type:varchar;size:255;" json:"stoppedTime"`
}

// WorkspaceRuntimeSeconds computes how long this WorkspaceInstance has been running.
// If the instance is still running (no stopping time set), maxStopTime is used to to compute the duration - this is an upper bound on stop
func (i *WorkspaceInstanceForUsage) WorkspaceRuntimeSeconds(maxStopTime time.Time) int64 {
	start := i.StartedTime.Time()
	stop := maxStopTime

	if i.StoppingTime.IsSet() {
		if i.StoppingTime.Time().Before(maxStopTime) {
			stop = i.StoppingTime.Time()
		}
	}

	return int64(stop.Sub(start).Round(time.Second).Seconds())
}
