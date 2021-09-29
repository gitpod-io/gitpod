// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"testing"
)

func DeferCloser(t *testing.T, closer []func() error) {
	// Much "defer", we run the closer in reversed order. This way, we can
	// append to this list quite naturally, and still break things down in
	// the correct order.
	t.Cleanup(func() {
		for i := len(closer) - 1; i >= 0; i-- {
			err := closer[i]()
			if err != nil {
				t.Logf("cleanup failed: %q", err)
			}
		}
	})
}
