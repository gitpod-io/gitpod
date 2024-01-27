// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"flag"
	"os"
	"testing"
)

func init() {
	// Ensure that the randomisation always returns the same values
	rootOpts.SeedValue = 42
}

func TestMain(m *testing.M) {
	flag.Parse()
	os.Exit(m.Run())
}
