// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package examples

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestGetWorkspaces(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Second)
	defer it.Done()

	wsman := it.API().WorkspaceManager()
	_, err := wsman.GetWorkspaces(ctx, &api.GetWorkspacesRequest{})
	if err != nil {
		t.Fatal(err)
	}
}
