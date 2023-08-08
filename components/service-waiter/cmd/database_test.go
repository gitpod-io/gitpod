// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	_ "embed"
	"os"
	"strings"
	"testing"
)

func TestGetLatestMigrationName(t *testing.T) {
	t.Run("should have latest migration name", func(t *testing.T) {
		path, err := os.Getwd()
		if err != nil {
			t.Errorf("failed to get current work dir: %v", err)
			return
		}
		if !strings.Contains(path, "components-service-waiter--app") {
			t.Skip("skipping test; not running in leeway build")
			return
		}
		if GetLatestMigrationName() == "" {
			t.Errorf("migration name should not be empty")
		}
	})
}
