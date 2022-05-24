// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"fmt"
	driver_mysql "github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"testing"
	"time"
)

type ConnectionParams struct {
	User     string
	Password string
	Host     string
	Database string
}

func Connect(p ConnectionParams) (*gorm.DB, error) {
	loc, err := time.LoadLocation("UTC")
	if err != nil {
		return nil, fmt.Errorf("failed to load UT location: %w", err)
	}
	cfg := driver_mysql.Config{
		User:                 p.User,
		Passwd:               p.Password,
		Net:                  "tcp",
		Addr:                 p.Host,
		DBName:               p.Database,
		Loc:                  loc,
		AllowNativePasswords: true,
		ParseTime:            true,
	}

	// refer to https://github.com/go-sql-driver/mysql#dsn-data-source-name for details
	return gorm.Open(mysql.Open(cfg.FormatDSN()), &gorm.Config{})
}

func ConnectForTests(t *testing.T) *gorm.DB {
	t.Helper()

	// These are static connection details for tests, started by `leeway components/usage:init-testdb`.
	// We use the same static credentials for CI & local instance of MySQL Server.
	conn, err := Connect(ConnectionParams{
		User:     "root",
		Password: "test",
		Host:     "localhost:23306",
		Database: "gitpod",
	})
	require.NoError(t, err, "Failed to establish connection to DB. In a workspace, run `leeway components/usage:init-testdb` once to bootstrap the DB.")

	t.Cleanup(func() {
		rawConn, err := conn.DB()
		require.NoError(t, err)

		require.NoError(t, rawConn.Close(), "must close database connection")
	})

	return conn
}
