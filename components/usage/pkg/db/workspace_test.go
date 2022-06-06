// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"strings"
	"testing"
)

var testObject = map[string]interface{}{
	"id":           "a0089911-5efc-4e2d-8714-0d3f67d82769",
	"creationTime": "2019-05-10T09:54:28.185Z",
	"ownerId":      "39051644-7a8f-4ddb-8bd3-fbede229ad4e",
	"contextURL":   "https://github.com/gitpod-io/gitpod",
	"description":  "gitpod-io/gitpod - master",
	"context": "{\"isFile\":false,\"path\":\"\",\"" +
		"title\":\"gitpod-io/gitpod - master\",\"" +
		"ref\":\"master\",\"" +
		"revision\":\"6a463917e0718d36ee764a898db2801bc4da580f\",\"" +
		"repository\":{\"cloneUrl\":\"https://github.com/gitpod-io/gitpod.git\",\"" +
		"host\":\"github.com\",\"" +
		"name\":\"gitpod\",\"" +
		"owner\":\"gitpod-io\",\"" +
		"private\":false}}",
	"config":                "{\"ports\":[{\"port\":3000}],\"tasks\":[],\"image\":\"eu.gcr.io/gitpod-dev/workspace-full:master.1458\"}",
	"archived":              "0",
	"shareable":             "0",
	"imageSource":           "{\"baseImageResolved\":\"eu.gcr.io/gitpod-dev/workspace-full@sha256:9c0892d1901210f3999c9bd64e371038bfc0505f04858e959e1bb3778dcf19c1\"}",
	"imageNameResolved":     "eu.gcr.io/gitpod-dev/workspace-full@sha256:9c0892d1901210f3999c9bd64e371038bfc0505f04858e959e1bb3778dcf19c1",
	"_lastModified":         "2020-04-14T00:31:26.101Z",
	"deleted":               "0",
	"type":                  "regular",
	"baseImageNameResolved": "eu.gcr.io/gitpod-dev/workspace-full@sha256:9c0892d1901210f3999c9bd64e371038bfc0505f04858e959e1bb3778dcf19c1",
	"softDeleted":           "gc",
	"pinned":                "0",
	"softDeletedTime":       "2020-03-24T00:03:03.777Z",
	"contentDeletedTime":    "2020-04-14T00:31:22.979Z",
	//"basedOnPrebuildId":     null,
	//"basedOnSnapshotId":     null,
	//"projectId":             null,
	"cloneURL": "",
}

func TestRead(t *testing.T) {
	conn := db.ConnectForTests(t)

	insertRawWorkspace(t, conn, testObject)

	var ws db.Workspace
	tx := conn.First(&ws)
	require.NoError(t, tx.Error)

	require.Equal(t, stringToVarchar(t, testObject["creationTime"].(string)), ws.CreationTime)
	require.Equal(t, stringToVarchar(t, testObject["softDeletedTime"].(string)), ws.SoftDeletedTime)
	require.Equal(t, testObject["context"].(string), ws.Context.String())
}

func insertRawWorkspace(t *testing.T, conn *gorm.DB, rawWorkspace map[string]interface{}) string {
	columns := []string{
		"id", "creationTime",
		"ownerId", "contextURL", "description", "context", "config", "imageSource", "imageNameResolved", "archived", "shareable",
		"deleted", "type", "baseImageNameResolved", "softDeleted", "pinned", "softDeletedTime", "contentDeletedTime", "basedOnPrebuildId", "basedOnSnapshotId", "projectId", "cloneURL",
	}
	statement := fmt.Sprintf(`
	INSERT INTO d_b_workspace (
		%s
	) VALUES ?;`, strings.Join(columns, ", "))
	id := insertRawObject(t, conn, columns, statement, rawWorkspace)

	return id
}

func stringToVarchar(t *testing.T, s string) db.VarcharTime {
	t.Helper()

	converted, err := db.NewVarcharTimeFromStr(s)
	require.NoError(t, err)
	return converted
}

func TestListWorkspacesByID(t *testing.T) {
	conn := db.ConnectForTests(t)

	workspaces := []db.Workspace{
		dbtest.NewWorkspace(t, "gitpodio-gitpod-aaaaaaaaaaa"),
		dbtest.NewWorkspace(t, "gitpodio-gitpod-bbbbbbbbbbb"),
	}
	tx := conn.Create(workspaces)
	require.NoError(t, tx.Error)

	for _, scenario := range []struct {
		Name     string
		QueryIDs []string
		Expected int
	}{
		{
			Name:     "no query ids returns empty results",
			QueryIDs: nil,
			Expected: 0,
		},
		{
			Name:     "not found id returns emtpy results",
			QueryIDs: []string{"gitpodio-gitpod-xxxxxxxxxxx"},
			Expected: 0,
		},
		{
			Name:     "one matching returns results",
			QueryIDs: []string{workspaces[0].ID},
			Expected: 1,
		},
		{
			Name:     "one matching and one non existent returns one found result",
			QueryIDs: []string{workspaces[0].ID, "gitpodio-gitpod-xxxxxxxxxxx"},
			Expected: 1,
		},
		{
			Name:     "multiple matching ids return results for each",
			QueryIDs: []string{workspaces[0].ID, workspaces[1].ID},
			Expected: 2,
		},
	} {
		t.Run(scenario.Name, func(t *testing.T) {
			results, err := db.ListWorkspacesByID(context.Background(), conn, scenario.QueryIDs)
			require.NoError(t, err)
			require.Len(t, results, scenario.Expected)
		})

	}
}
