// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"net/rpc"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
)

func IsCgroupV2(rsa *rpc.Client) (bool, error) {
	var resp agent.ExecResponse
	err := rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     "/",
		Command: "bash",
		Args: []string{
			"-c",
			"test -f /sys/fs/cgroup/cgroup.controllers",
		},
	}, &resp)
	if resp.ExitCode == 1 {
		return false, nil
	}

	if err != nil {
		return false, err
	}

	return resp.ExitCode == 0, nil
}
