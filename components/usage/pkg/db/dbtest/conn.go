// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbtest

import (
	"sync"
	"testing"

	common_db "github.com/gitpod-io/gitpod/common-go/db"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var (
	connLock = sync.Mutex{}
	conn     *gorm.DB
)

func ConnectForTests(t *testing.T) *gorm.DB {
	t.Helper()

	connLock.Lock()
	defer connLock.Unlock()

	if conn != nil {
		return conn
	}

	// These are static connection details for tests, started by `leeway components/usage:init-testdb`.
	// We use the same static credentials for CI & local instance of MySQL Server.
	var err error
	conn, err = common_db.Connect(common_db.ConnectionParams{
		User:     "root",
		Password: "test",
		Host:     "localhost:23306",
		Database: "gitpod",
	})
	require.NoError(t, err, "Failed to establish connection to DB. In a workspace, run `leeway build components/usage:init-testdb` once to bootstrap the DB.")

	return conn
}
