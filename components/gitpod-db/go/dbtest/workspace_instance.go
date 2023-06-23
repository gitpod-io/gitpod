// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"context"
	"database/sql"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var (
	workspaceInstanceStatus = `{"phase": "stopped", "conditions": {"deployed": false, "pullingImages": false, "serviceExists": false}}`
)

func NewWorkspaceInstance(t *testing.T, instance db.WorkspaceInstance) db.WorkspaceInstance {
	t.Helper()

	id := uuid.New()
	if instance.ID != uuid.Nil {
		id = instance.ID
	}

	workspaceID := GenerateWorkspaceID()
	if instance.WorkspaceID != "" {
		workspaceID = instance.WorkspaceID
	}

	creationTime := db.VarcharTime{}
	if instance.CreationTime.IsSet() {
		creationTime = instance.CreationTime
	} else if instance.StartedTime.IsSet() {
		creationTime = instance.StartedTime
	}

	startedTime := db.VarcharTime{}
	if instance.StartedTime.IsSet() {
		startedTime = instance.StartedTime
	}

	deployedTime := db.VarcharTime{}
	if instance.DeployedTime.IsSet() {
		deployedTime = instance.DeployedTime
	}

	stoppedTime := db.VarcharTime{}
	if instance.StoppedTime.IsSet() {
		stoppedTime = instance.StoppedTime
	} else if instance.StoppingTime.IsSet() {
		creationTime = instance.StoppingTime
	}

	stoppingTime := db.VarcharTime{}
	if instance.StoppingTime.IsSet() {
		stoppingTime = instance.StoppingTime
	}

	status := []byte(workspaceInstanceStatus)
	if instance.Status.String() != "" {
		status = instance.Status
	}

	attributionID := db.NewTeamAttributionID(uuid.New().String())
	if instance.UsageAttributionID != "" {
		attributionID = instance.UsageAttributionID
	}

	workspaceClass := db.WorkspaceClass_Default
	if instance.WorkspaceClass != "" {
		workspaceClass = instance.WorkspaceClass
	}

	phasePersisted := ""
	if instance.PhasePersisted != "" {
		phasePersisted = instance.PhasePersisted
	}

	return db.WorkspaceInstance{
		ID:                 id,
		WorkspaceID:        workspaceID,
		UsageAttributionID: attributionID,
		WorkspaceClass:     workspaceClass,
		Configuration:      nil,
		Region:             "",
		ImageBuildInfo:     sql.NullString{},
		IdeURL:             "",
		WorkspaceBaseImage: "",
		WorkspaceImage:     "",
		CreationTime:       creationTime,
		StartedTime:        startedTime,
		DeployedTime:       deployedTime,
		StoppedTime:        stoppedTime,
		LastModified:       time.Time{},
		StoppingTime:       stoppingTime,
		LastHeartbeat:      "",
		StatusOld:          sql.NullString{},
		Status:             status,
		Phase:              sql.NullString{},
		PhasePersisted:     phasePersisted,
	}
}

func CreateWorkspaceInstances(t *testing.T, conn *gorm.DB, instances ...db.WorkspaceInstance) []db.WorkspaceInstance {
	t.Helper()

	var records []db.WorkspaceInstance
	var ids []string
	for _, instance := range instances {
		record := NewWorkspaceInstance(t, instance)
		records = append(records, record)
		ids = append(ids, record.ID.String())
	}

	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		require.NoError(t, conn.Where(ids).Delete(&db.WorkspaceInstance{}).Error)
	})

	return records
}

func FindStoppedWorkspaceInstancesInRange(t *testing.T, conn *gorm.DB, from, to time.Time, workspaceID string) []db.WorkspaceInstanceForUsage {
	all, err := db.FindStoppedWorkspaceInstancesInRange(context.Background(), conn, from, to)
	require.NoError(t, err)
	return filterByWorkspaceId(all, workspaceID)
}

func FindRunningWorkspaceInstances(t *testing.T, conn *gorm.DB, workspaceID string) []db.WorkspaceInstanceForUsage {
	all, err := db.FindRunningWorkspaceInstances(context.Background(), conn)
	require.NoError(t, err)
	return filterByWorkspaceId(all, workspaceID)
}

func filterByWorkspaceId(all []db.WorkspaceInstanceForUsage, workspaceID string) []db.WorkspaceInstanceForUsage {
	var result []db.WorkspaceInstanceForUsage
	for _, candidate := range all {
		if candidate.WorkspaceID == workspaceID {
			result = append(result, candidate)
		}
	}
	return result
}
