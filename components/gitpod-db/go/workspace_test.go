// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"

	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/stretchr/testify/require"
)

func stringToVarchar(t *testing.T, s string) db.VarcharTime {
	t.Helper()

	converted, err := db.NewVarCharTimeFromStr(s)
	require.NoError(t, err)
	return converted
}

func TestListWorkspacesByID(t *testing.T) {
	workspaces := []db.Workspace{
		dbtest.NewWorkspace(t, db.Workspace{}),
		dbtest.NewWorkspace(t, db.Workspace{}),
	}

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
			conn := dbtest.ConnectForTests(t)
			dbtest.CreateWorkspaces(t, conn, workspaces...)

			results, err := db.ListWorkspacesByID(context.Background(), conn, scenario.QueryIDs)
			require.NoError(t, err)
			require.Len(t, results, scenario.Expected)
		})

	}
}
