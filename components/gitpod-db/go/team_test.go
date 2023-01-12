// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"

	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestTeam_Save(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	team := &db.Team{
		ID:            uuid.New(),
		Name:          "Test Team",
		Slug:          "test-team",
		CreationTime:  stringToVarchar(t, "2021-11-01T19:36:07.532Z"),
		MarkedDeleted: false,
	}

	team, err := db.SaveTeam(context.Background(), conn, team)
	assert.NoError(t, err)

	team, err = db.GetTeam(context.Background(), conn, team.ID)
	assert.NoError(t, err)
	assert.Equal(t, "Test Team", team.Name)
	assert.Equal(t, "test-team", team.Slug)
	assert.Equal(t, stringToVarchar(t, "2021-11-01T19:36:07.532Z"), team.CreationTime)
}
