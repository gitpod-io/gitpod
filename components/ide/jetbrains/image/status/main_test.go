// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"testing"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/google/go-cmp/cmp"
)

func TestGetProductConfig(t *testing.T) {
	expectation := &protocol.JetBrainsProduct{}
	actual := getProductConfig(&protocol.GitpodConfig{
		JetBrains: &protocol.JetBrains{
			IntelliJ: expectation,
		},
	}, "intellij")

	if diff := cmp.Diff(expectation, actual); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}
}
