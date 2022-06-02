// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"fmt"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"strings"
	"testing"
)

var workspaceInstanceJSON = map[string]interface{}{
	"id":                 "2f9a29bb-406e-4494-b592-c99f7fa0e793",
	"workspaceId":        "gitpodio-ops-b8fqh3eylmr",
	"region":             "eu03",
	"creationTime":       "2022-05-31T15:22:57.192Z",
	"startedTime":        "2022-05-31T15:24:04.336Z",
	"deployedTime":       "",
	"stoppedTime":        "2022-05-31T15:24:50.361Z",
	"lastHeartbeat":      "",
	"ideUrl":             "https://gitpodio-ops-b8fqh3eylmr.ws-eu03.gitpod-staging.com",
	"workspaceBaseImage": "",
	"workspaceImage":     "eu.gcr.io/gitpod-dev/workspace-images:59e2c9722f56918c0e84f2640880fee0c19ac40471e968faaddcdcaebaf0df58",
	"status_old":         nil,
	"_lastModified":      "2022-05-31 15:24:50.373117",
	"status":             "{\"repo\": {\"branch\": \"main\", \"latestCommit\": \"25d888e90dd21eb98be699c0b43556c153d667c9\", \"totalUntrackedFiles\": 0, \"totalUncommitedFiles\": 0, \"totalUnpushedCommits\": 0}, \"phase\": \"stopped\", \"nodeIp\": \"10.132.0.14\", \"message\": \"\", \"podName\": \"prebuild-2f9a29bb-406e-4494-b592-c99f7fa0e791\", \"timeout\": \"30m0s\", \"nodeName\": \"ws-eu03.gitpod-staging.com\", \"conditions\": {\"failed\": \"\", \"timeout\": \"\", \"deployed\": false, \"pullingImages\": false, \"stoppedByRequest\": false, \"headlessTaskFailed\": \"\"}, \"ownerToken\": \"4.MIXs2XurX1vMP7bTEryt9R9IbzGT_D\", \"exposedPorts\": []}",
	"phase":              "stopped",
	"deleted":            0,
	"phasePersisted":     "stopped",
	"configuration":      "{\"ideImage\":\"eu.gcr.io/gitpod-core-dev/build/ide/code:commit-80d9b1ebfd826fd0db25320ba94d762b51887ada\",\"supervisorImage\":\"eu.gcr.io/gitpod-core-dev/build/supervisor:commit-1d4be665efdd1507f92b185afd112a7568d21a42\",\"ideConfig\":{\"useLatest\":false},\"featureFlags\":[\"registry_facade\",\"fixed_resources\"]}",
	"stoppingTime":       "2022-05-31T15:24:39.657Z",
	"imageBuildInfo":     nil,
}

func TestWorkspaceInstance_ReadExistingRecords(t *testing.T) {
	conn := db.ConnectForTests(t)
	id := insertRawWorkspaceInstance(t, conn, workspaceInstanceJSON)

	wsi := db.WorkspaceInstance{ID: id}
	tx := conn.First(&wsi)
	require.NoError(t, tx.Error)

	require.Equal(t, id, wsi.ID)

	require.True(t, wsi.StoppingTime.IsSet())
	require.Equal(t, stringToVarchar(t, workspaceInstanceJSON["stoppingTime"].(string)), wsi.StoppingTime)

	require.True(t, wsi.StartedTime.IsSet())
	require.Equal(t, stringToVarchar(t, workspaceInstanceJSON["startedTime"].(string)), wsi.StartedTime)

	require.False(t, wsi.DeployedTime.IsSet())

	require.True(t, wsi.StoppedTime.IsSet())
	require.Equal(t, stringToVarchar(t, workspaceInstanceJSON["stoppedTime"].(string)), wsi.StoppedTime)

	require.True(t, wsi.CreationTime.IsSet())
	require.Equal(t, stringToVarchar(t, workspaceInstanceJSON["creationTime"].(string)), wsi.CreationTime)

	require.Equal(t, workspaceInstanceJSON["status"], wsi.Status.String())
	require.Equal(t, workspaceInstanceJSON["configuration"], wsi.Configuration.String())
}

func insertRawWorkspaceInstance(t *testing.T, conn *gorm.DB, object map[string]interface{}) uuid.UUID {
	columns := []string{"id", "workspaceId", "region", "creationTime", "startedTime", "deployedTime", "stoppedTime", "lastHeartbeat", "ideUrl", "workspaceBaseImage", "workspaceImage", "status_old", "_lastModified", "status", "deleted", "phasePersisted", "configuration", "stoppingTime", "imageBuildInfo"}
	statement := fmt.Sprintf(`INSERT INTO d_b_workspace_instance (%s) VALUES ?;`, strings.Join(columns, ", "))
	id := uuid.MustParse(insertRawObject(t, conn, columns, statement, object))

	t.Cleanup(func() {
		tx := conn.Delete(&db.WorkspaceInstance{ID: id})
		require.NoError(t, tx.Error)
	})

	return id
}

func insertRawObject(t *testing.T, conn *gorm.DB, columns []string, statement string, obj map[string]interface{}) string {
	t.Helper()

	id := obj["id"].(string)

	var values []interface{}
	for _, col := range columns {
		val, ok := obj[col]
		if !ok {
			values = append(values, "null")
		} else {
			values = append(values, val)
		}
	}

	tx := conn.Exec(statement, values)
	require.NoError(t, tx.Error)

	return id
}
