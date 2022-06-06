// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestUsageReconciler_Reconcile(t *testing.T) {
	conn := db.ConnectForTests(t)
	workspaceID := "gitpodio-gitpod-gyjr82jkfnd"
	instanceStatus := []byte(`{"phase": "stopped", "conditions": {"deployed": false, "pullingImages": false, "serviceExists": false}}`)
	startOfMay := time.Date(2022, 05, 1, 0, 00, 00, 00, time.UTC)
	startOfJune := time.Date(2022, 06, 1, 0, 00, 00, 00, time.UTC)
	instances := []db.WorkspaceInstance{
		{
			ID:           uuid.New(),
			WorkspaceID:  workspaceID,
			CreationTime: db.NewVarcharTime(time.Date(2022, 05, 1, 00, 00, 00, 00, time.UTC)),
			StoppedTime:  db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
			Status:       instanceStatus,
		},
		// No creation time, invalid record
		{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			StoppedTime: db.NewVarcharTime(time.Date(2022, 06, 1, 1, 0, 0, 0, time.UTC)),
			Status:      instanceStatus,
		},
	}

	tx := conn.Create(instances)
	require.NoError(t, tx.Error)

	reconciler := NewUsageReconciler(conn)

	status, err := reconciler.ReconcileTimeRange(context.Background(), startOfMay, startOfJune)
	require.NoError(t, err)
	require.Equal(t, &UsageReconcileStatus{
		StartTime:                 startOfMay,
		EndTime:                   startOfJune,
		WorkspaceInstances:        1,
		InvalidWorkspaceInstances: 1,
	}, status)
}
