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
	"math/rand"
	"testing"
	"time"
)

func NewWorkspaceInstanceUsage(t *testing.T, record db.WorkspaceInstanceUsage) db.WorkspaceInstanceUsage {
	t.Helper()

	userID := uuid.New()
	if record.UserID.ID() != 0 {
		userID = record.UserID
	}

	instanceID := uuid.New()
	if record.InstanceID.ID() != 0 {
		instanceID = record.InstanceID
	}

	attributionID := db.NewUserAttributionID(userID.String())
	if record.AttributionID != "" {
		attributionID = record.AttributionID
	}

	workspaceID := GenerateWorkspaceID()
	if record.WorkspaceID != "" {
		workspaceID = record.WorkspaceID
	}

	projectID := uuid.New().String()
	if record.ProjectID != "" {
		projectID = record.ProjectID
	}

	workspaceType := db.WorkspaceType_Regular
	if record.WorkspaceType != "" {
		workspaceType = record.WorkspaceType
	}

	workspaceClass := db.WorkspaceClass_Default
	if record.WorkspaceClass != "" {
		workspaceClass = record.WorkspaceClass
	}

	credits := rand.Float64()
	if record.CreditsUsed != 0 {
		credits = record.CreditsUsed
	}

	started := time.Date(2022, 7, 14, 10, 30, 30, 5000, time.UTC)
	if !record.StartedAt.IsZero() {
		started = record.StartedAt
	}

	stopped := sql.NullTime{}
	if record.StoppedAt.Valid {
		stopped = record.StoppedAt
	}

	return db.WorkspaceInstanceUsage{
		InstanceID:     instanceID,
		AttributionID:  attributionID,
		UserID:         userID,
		WorkspaceID:    workspaceID,
		ProjectID:      projectID,
		WorkspaceType:  workspaceType,
		WorkspaceClass: workspaceClass,
		CreditsUsed:    credits,
		StartedAt:      started,
		StoppedAt:      stopped,
		GenerationID:   0,
	}
}

func CreateWorkspaceInstanceUsageRecords(t *testing.T, conn *gorm.DB, instancesUsages ...db.WorkspaceInstanceUsage) []db.WorkspaceInstanceUsage {
	t.Helper()

	if len(instancesUsages) == 0 {
		return nil
	}

	var ids []string
	for _, instanceUsage := range instancesUsages {
		ids = append(ids, instanceUsage.InstanceID.String())
	}

	require.NoError(t, conn.CreateInBatches(&instancesUsages, 1000).Error)

	t.Cleanup(func() {
		require.NoError(t, conn.Where(ids).Delete(&db.WorkspaceInstanceUsage{}).Error)
	})

	return instancesUsages
}
