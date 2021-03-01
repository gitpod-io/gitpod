// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"fmt"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	agent "github.com/gitpod-io/gitpod/test/tests/storage/daemon_agent/api"
)

func TestCreateBucket(t *testing.T) {
	it, _ := integration.NewTest(t, 30*time.Second)
	defer it.Done()

	rsa, err := it.Instrument(integration.ComponentWorkspaceDaemon, "daemon")
	if err != nil {
		t.Fatal(err)
		return
	}

	var resp agent.CreateBucketResponse
	err = rsa.Call("DaemonAgent.CreateBucket", agent.CreateBucketRequest{
		Owner:     fmt.Sprintf("integration-test-%d", time.Now().UnixNano()),
		Workspace: "test-ws",
	}, &resp)
	if err != nil {
		t.Fatalf("cannot create bucket: %q", err)
	}
}
