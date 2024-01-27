// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"fmt"
	"strings"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
)

type DiskClient struct {
	rpcClient *RpcClient
}

func Disk(rsa *RpcClient) DiskClient {
	return DiskClient{rsa}
}

var NoSpaceErrorMsg = "No space left on device"

func (d DiskClient) Fallocate(testFilePath string, spaceToAllocate string) error {
	var resp agent.ExecResponse
	err := d.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     "/workspace",
		Command: "fallocate",
		Args:    []string{"-l", spaceToAllocate, testFilePath},
	}, &resp)

	if err != nil {
		return fmt.Errorf("error: %w", err)
	}
	if resp.ExitCode != 0 {
		return fmt.Errorf("returned returned rc: %d err: %v", resp.ExitCode, resp.Stderr)
	}
	if strings.Contains(resp.Stdout, NoSpaceErrorMsg) {
		return fmt.Errorf(resp.Stdout)
	}

	return nil
}
