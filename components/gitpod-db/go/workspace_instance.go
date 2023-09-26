// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"

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

	// deleted is restricted for use by periodic deleter
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (i *WorkspaceInstance) TableName() string {
	return "d_b_workspace_instance"
}

// FindStoppedWorkspaceInstancesInRange finds WorkspaceInstanceForUsage that have been stopped between from (inclusive) and to (exclusive).
func FindStoppedWorkspaceInstancesInRange(ctx context.Context, conn *gorm.DB, from, to time.Time) ([]WorkspaceInstanceForUsage, error) {
	var instances []WorkspaceInstanceForUsage
	var instancesInBatch []WorkspaceInstanceForUsage

	tx := queryWorkspaceInstanceForUsage(ctx, conn).
		Where("wsi.stoppingTime >= ?", TimeToISO8601(from)).
		Where("wsi.stoppingTime < ?", TimeToISO8601(to)).
		Where("wsi.stoppingTime != ?", "").
		Where("wsi.usageAttributionId != ?", "").
		FindInBatches(&instancesInBatch, 1000, func(_ *gorm.DB, _ int) error {
			instances = append(instances, instancesInBatch...)
			return nil
		})
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to find workspace instances: %w", tx.Error)
	}

	return instances, nil
}

// FindRunningWorkspaceInstances finds WorkspaceInstanceForUsage that are running at the point in time the query is executed.
func FindRunningWorkspaceInstances(ctx context.Context, conn *gorm.DB) ([]WorkspaceInstanceForUsage, error) {
	var instances []WorkspaceInstanceForUsage
	var instancesInBatch []WorkspaceInstanceForUsage

	tx := queryWorkspaceInstanceForUsage(ctx, conn).
		Where("wsi.phasePersisted = ?", "running").
		// We are only interested in instances that have been started within the last 10 days.
		Where("wsi.startedTime > ?", TimeToISO8601(time.Now().Add(-10*24*time.Hour))).
		// All other selectors are there to ensure data quality
		Where("wsi.stoppingTime = ?", "").
		Where("wsi.usageAttributionId != ?", "").
		FindInBatches(&instancesInBatch, 1000, func(_ *gorm.DB, _ int) error {
			instances = append(instances, instancesInBatch...)
			return nil
		})
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to find running workspace instances: %w", tx.Error)
	}

	return instances, nil
}

// FindWorkspaceInstancesByIds finds WorkspaceInstanceForUsage by Id.
func FindWorkspaceInstancesByIds(ctx context.Context, conn *gorm.DB, workspaceInstanceIds []uuid.UUID) ([]WorkspaceInstanceForUsage, error) {
	var instances []WorkspaceInstanceForUsage
	var instancesInBatch []WorkspaceInstanceForUsage
	var idChunks [][]uuid.UUID
	chunkSize, totalSize := 1000, len(workspaceInstanceIds)
	// explicit batching to reduce the lengths of the 'in'-part in the SELECT statement below
	for i := 0; i < totalSize; i += chunkSize {
		end := i + chunkSize
		if end > totalSize {
			end = totalSize
		}
		idChunks = append(idChunks, workspaceInstanceIds[i:end])
	}

	for _, idChunk := range idChunks {
		err := queryWorkspaceInstanceForUsage(ctx, conn).
			Where("wsi.id in ?", idChunk).
			Where("wsi.usageAttributionId != ?", "").
			Find(&instancesInBatch).Error
		if err != nil {
			return nil, fmt.Errorf("failed to find workspace instances by id: %w", err)
		}
		instances = append(instances, instancesInBatch...)
	}

	return instances, nil
}

func queryWorkspaceInstanceForUsage(ctx context.Context, conn *gorm.DB) *gorm.DB {
	return conn.WithContext(ctx).
		Table(fmt.Sprintf("%s as wsi", (&WorkspaceInstance{}).TableName())).
		Select("wsi.id as id, "+
			"ws.projectId as projectId, "+
			"ws.contextUrl as contextUrl, "+
			"ws.type as workspaceType, "+
			"wsi.workspaceClass as workspaceClass, "+
			"wsi.usageAttributionId as usageAttributionId, "+
			"wsi.startedTime as startedTime, "+
			"wsi.stoppingTime as stoppingTime, "+
			"wsi.stoppedTime as stoppedTime, "+
			"ws.ownerId as ownerId, "+
			"wsi.workspaceId as workspaceId, "+
			"ws.ownerId as userId, "+
			"u.name as userName, "+
			"u.avatarURL as userAvatarURL ",
		).
		Joins(fmt.Sprintf("LEFT JOIN %s AS ws ON wsi.workspaceId = ws.id", (&Workspace{}).TableName())).
		Joins(fmt.Sprintf("LEFT JOIN %s AS u ON ws.ownerId = u.id", "d_b_user")).
		// Instances without a StartedTime never actually started, we're not interested in these.
		Where("wsi.startedTime != ?", "")
}

const (
	attributionEntity_Team = "team"
)

func NewTeamAttributionID(teamID string) AttributionID {
	return AttributionID(fmt.Sprintf("%s:%s", attributionEntity_Team, teamID))
}

// AttributionID consists of an entity, and an identifier in the form:
// <entity>:<identifier>, e.g. team:a7dcf253-f05e-4dcf-9a47-cf8fccc74717
type AttributionID string

func (a AttributionID) Values() (entity string, identifier string) {
	tokens := strings.Split(string(a), ":")
	if len(tokens) != 2 || tokens[0] != attributionEntity_Team || tokens[1] == "" {
		return "", ""
	}

	return tokens[0], tokens[1]
}

func ParseAttributionID(s string) (AttributionID, error) {
	tokens := strings.Split(s, ":")
	if len(tokens) != 2 {
		return "", fmt.Errorf("attribution ID (%s) does not have two parts", s)
	}
	_, err := uuid.Parse(tokens[1])
	if err != nil {
		return "", fmt.Errorf("The uuid part of attribution ID (%s) is not a valid UUID. %w", tokens[1], err)
	}

	switch tokens[0] {
	case attributionEntity_Team:
		return NewTeamAttributionID(tokens[1]), nil
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
	ContextURL         string         `gorm:"column:contextUrl;type:varchar;size:255;" json:"contextUrl"`
	UserID             uuid.UUID      `gorm:"column:userId;type:varchar;size:255;" json:"userId"`
	UserName           string         `gorm:"column:userName;type:varchar;size:255;" json:"userName"`
	UserAvatarURL      string         `gorm:"column:userAvatarURL;type:varchar;size:255;" json:"userAvatarURL"`

	StartedTime  VarcharTime `gorm:"column:startedTime;type:varchar;size:255;" json:"startedTime"`
	StoppingTime VarcharTime `gorm:"column:stoppingTime;type:varchar;size:255;" json:"stoppingTime"`
	StoppedTime  VarcharTime `gorm:"column:stoppedTime;type:varchar;size:255;" json:"stoppedTime"`
}

// WorkspaceRuntimeSeconds computes how long this WorkspaceInstance has been running.
// If the instance is still running (no stopping time set), maxStopTime is used to to compute the duration - this is an upper bound on stop
func (i *WorkspaceInstanceForUsage) WorkspaceRuntimeSeconds(stopTimeIfInstanceIsStillRunning time.Time) int64 {
	start := i.StartedTime.Time()
	stop := stopTimeIfInstanceIsStillRunning

	if i.StoppingTime.IsSet() {
		stop = i.StoppingTime.Time()
	} else if i.StoppedTime.IsSet() {
		stop = i.StoppedTime.Time()
	}

	if stop.Before(start) {
		log.
			WithField("instance_id", i.ID).
			WithField("workspace_id", i.WorkspaceID).
			WithField("started_time", TimeToISO8601(i.StartedTime.Time())).
			WithField("started_time_set", i.StartedTime.IsSet()).
			WithField("stopping_time_set", i.StoppingTime.IsSet()).
			WithField("stopping_time", TimeToISO8601(i.StoppingTime.Time())).
			WithField("stopped_time_set", i.StoppedTime.IsSet()).
			WithField("stopped_time", TimeToISO8601(i.StoppedTime.Time())).
			WithField("stop_time_if_instance_still_running", stopTimeIfInstanceIsStillRunning).
			Errorf("Instance %s had stop time before start time. Using startedTime as stop time.", i.ID)

		stop = start
	}

	return int64(stop.Sub(start).Round(time.Second).Seconds())
}

func ListWorkspaceInstanceIDsWithPhaseStoppedButNoStoppingTime(ctx context.Context, conn *gorm.DB) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	//var chunk []uuid.UUID

	tx := conn.WithContext(ctx).
		Table(fmt.Sprintf("%s as wsi", (&WorkspaceInstance{}).TableName())).
		Joins(fmt.Sprintf("LEFT JOIN %s AS u ON wsi.id = u.id", (&Usage{}).TableName())).
		Where("wsi.phasePersisted = ?", "stopped").
		Where("wsi.stoppingTime = ''"). // empty
		Pluck("wsi.id", &ids)
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to list workspace instances with phase stopped but no stopping time: %w", tx.Error)
	}
	return ids, nil
}
