// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"testing"
)

func BenchmarkRenderWorkspacePortURL(b *testing.B) {
	b.ReportAllocs()

	for n := 0; n < b.N; n++ {
		RenderWorkspaceURL("{{.Port}}-{{.Prefix}}.{{.Host}}", "foo", "bar", "gitpod.io")
	}
}
