// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbtest

import (
	"database/sql"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"testing"
	"time"
)

var (
	workspaceInstanceStatus = `{"phase": "stopped", "conditions": {"deployed": false, "pullingImages": false, "serviceExists": false}}`
)

func NewWorkspaceInstance(t *testing.T, instance db.WorkspaceInstance) db.WorkspaceInstance {
	t.Helper()

	id := uuid.New()
	if instance.ID.ID() != 0 { // empty value
		id = instance.ID
	}

	workspaceID := GenerateWorkspaceID()
	if instance.WorkspaceID != "" {
		workspaceID = instance.WorkspaceID
	}

	creationTime := db.VarcharTime{}
	if instance.CreationTime.IsSet() {
		creationTime = instance.CreationTime
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
	}

	stoppingTime := db.VarcharTime{}
	if instance.StoppingTime.IsSet() {
		stoppingTime = instance.StoppingTime
	}

	status := []byte(workspaceInstanceStatus)
	if instance.Status.String() != "" {
		status = instance.Status
	}

	attributionID := db.NewUserAttributionID(uuid.New().String())
	if instance.UsageAttributionID != "" {
		attributionID = instance.UsageAttributionID
	}

	return db.WorkspaceInstance{
		ID:                 id,
		WorkspaceID:        workspaceID,
		UsageAttributionID: attributionID,
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
		PhasePersisted:     "",
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
