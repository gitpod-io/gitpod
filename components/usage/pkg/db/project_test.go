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

var projectJSON = map[string]interface{}{
	"id":                "49b5d309-bb95-4a79-846c-e3cf42c0d591",
	"cloneUrl":          "https://github.com/gptest1/gptest1-repo1-private.git",
	"teamId":            "0e433063-1358-4892-9ed2-68e273d17d07",
	"appInstallationId": "20446411",
	"creationTime":      "2021-11-01T19:36:07.532Z",
	"deleted":           0,
	"_lastModified":     "2021-11-02 10:49:12.473658",
	"name":              "gptest1-repo1-private",
	"config":            "{\".gitpod.yml\":\"tasks:\\n  - init: |\\n      echo 'TODO: build project'\\n    command: |\\n      echo 'TODO: start app'\"}",
	"markedDeleted":     1,
	"userId":            nil,
	"slug":              "gptest1-repo1-private",
	"settings":          nil,
}

func TestProject_ReadExistingRecords(t *testing.T) {
	conn := db.ConnectForTests(t)

	id := insertRawProject(t, conn, projectJSON)

	project := db.Project{ID: id}
	tx := conn.First(&project)
	require.NoError(t, tx.Error)

	require.Equal(t, id, project.ID)
	require.Equal(t, projectJSON["teamId"], project.TeamID.String)
	require.Equal(t, stringToVarchar(t, "2021-11-01T19:36:07.532Z"), project.CreationTime)
}

func insertRawProject(t *testing.T, conn *gorm.DB, obj map[string]interface{}) uuid.UUID {
	columns := []string{
		"id", "cloneUrl", "teamId", "appInstallationId", "creationTime", "deleted", "_lastModified", "name", "config", "markedDeleted", "userId", "slug", "settings",
	}
	statement := fmt.Sprintf(`INSERT INTO d_b_project (%s) VALUES ?;`, strings.Join(columns, ", "))
	id := uuid.MustParse(obj["id"].(string))

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

	t.Cleanup(func() {
		tx = conn.Delete(&db.Project{ID: id})
		require.NoError(t, tx.Error)
	})

	return id
}
