// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package examples

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestBuiltinUserExists(t *testing.T) {
	it, _ := integration.NewTest(t, 30*time.Second)
	defer it.Done()

	db := it.API().DB()
	rows, err := db.Query(`SELECT count(1) AS count FROM d_b_user WHERE id ="builtin-user-workspace-probe-0000000"`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	if !rows.Next() {
		t.Fatal("no rows selected - should not happen")
	}
	var count int
	err = rows.Scan(&count)
	if err != nil {
		t.Fatal(err)
	}

	if count != 1 {
		t.Fatalf("expected a single builtin-user-workspace-probe-0000000, but found %d", count)
	}
}
