// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"fmt"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
)

const (
	fuseProgram = `
#define _GNU_SOURCE
#include <unistd.h>

#include <sys/syscall.h>
#include <linux/fs.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <stdio.h>


int main() {
  const char* src_path = "/dev/fuse";
  unsigned int flags = O_RDWR;
  printf("RET: %ld\n", syscall(SYS_openat, AT_FDCWD, src_path, flags));
}
	`
)

func HasFuseDevice(rsa *RpcClient) (bool, error) {
	var resp agent.WriteFileResponse
	err := rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
		Path:    "/workspace/fuse_test.c",
		Content: []byte(fuseProgram),
		Mode:    0644,
	}, &resp)
	if err != nil {
		return false, err
	}

	var execResp agent.ExecResponse
	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     "/workspace",
		Command: "gcc",
		Args:    []string{"fuse_test.c", "-o", "fuse_test"},
	}, &execResp)
	if err != nil {
		return false, err
	}
	if execResp.ExitCode != 0 {
		return false, fmt.Errorf("gcc failed with code %d: %s", execResp.ExitCode, execResp.Stderr)
	}

	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     "/workspace",
		Command: "./fuse_test",
	}, &execResp)
	if err != nil {
		return false, err
	}
	if execResp.ExitCode != 0 {
		return false, fmt.Errorf("fuse_test failed with code %d: %s", execResp.ExitCode, execResp.Stderr)
	}

	if execResp.Stdout != "RET: 3\n" {
		return false, fmt.Errorf("fuse_test returned unexpected output: %s", execResp.Stdout)
	}
	return true, nil
}
