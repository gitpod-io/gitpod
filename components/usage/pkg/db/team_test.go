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

var teamJSON = map[string]interface{}{
	"id":            "2db3d0ae-9fa2-41ed-9781-acfc7e17294b",
	"name":          "Gitpod",
	"slug":          "gitpod",
	"creationTime":  "2021-07-22T11:46:43.281Z",
	"deleted":       0,
	"_lastModified": "2021-10-01 10:26:10.718585",
	"markedDeleted": 0,
}

func TestTeam_ReadFromExistingData(t *testing.T) {
	conn := db.ConnectForTests(t)
	id := insertRawTeam(t, conn, teamJSON)

	team := db.Team{ID: id}
	tx := conn.First(&team)
	require.NoError(t, tx.Error)

	require.Equal(t, id, team.ID)
	require.Equal(t, teamJSON["name"], team.Name)
	require.Equal(t, teamJSON["slug"], team.Slug)
	require.Equal(t, stringToVarchar(t, teamJSON["creationTime"].(string)), team.CreationTime)
	require.EqualValues(t, teamJSON["markedDeleted"] == 1, team.MarkedDeleted)
}

func insertRawTeam(t *testing.T, conn *gorm.DB, object map[string]interface{}) uuid.UUID {
	t.Helper()

	columns := []string{"id", "name", "slug", "creationTime", "deleted", "_lastModified", "markedDeleted"}
	statement := fmt.Sprintf(`INSERT INTO d_b_team (%s) VALUES ?;`, strings.Join(columns, ", "))

	id := uuid.MustParse(insertRawObject(t, conn, columns, statement, object))

	t.Cleanup(func() {
		tx := conn.Delete(&db.Team{ID: id})
		require.NoError(t, tx.Error)
	})

	return id
}
