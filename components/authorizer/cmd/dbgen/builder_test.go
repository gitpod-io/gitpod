// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"testing"

	"github.com/gitpod-io/gitpod/authorizer/pkg/executor"
)

func TestBuild(t *testing.T) {
	q := checkWorkspaceInstanceOwner("userfoo", "instancebla")
	res := executor.NewQuery(&executor.Namespace{}, "")
	executor.Build(q, res)
}
