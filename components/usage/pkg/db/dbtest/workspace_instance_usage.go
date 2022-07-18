// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbtest

import (
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"testing"
)

func CreateWorkspaceInstanceUsageRecords(t *testing.T, conn *gorm.DB, instancesUsages ...db.WorkspaceInstanceUsage) []db.WorkspaceInstanceUsage {
	t.Helper()

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
