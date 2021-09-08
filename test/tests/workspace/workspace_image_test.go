// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"strings"
	"testing"
	"time"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	imgapi "github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	agent "github.com/gitpod-io/gitpod/test/tests/workspace/workspace_agent/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestImageBuildPreservesEnvVarMk3(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	res := integration.LaunchWorkspaceDirectly(it, integration.WithWorkspaceImageRequest(&imgapi.ResolveWorkspaceImageRequest{
		Source: &imgapi.BuildSource{
			From: &imgapi.BuildSource_File{
				File: &imgapi.BuildSourceDockerfile{
					DockerfileVersion: "some-version",
					DockerfilePath:    ".gitpod.Dockerfile",
					ContextPath:       ".",
					Source: &csapi.WorkspaceInitializer{
						Spec: &csapi.WorkspaceInitializer_Git{
							Git: &csapi.GitInitializer{
								RemoteUri:  "https://github.com/gitpod-io/gitpod-test-repo.git",
								TargetMode: csapi.CloneTargetMode_REMOTE_BRANCH,
								// this branch has a docker file that adds 'MY_TEST_ENV_VAR=asd' as env var (ref: https://github.com/gitpod-io/gitpod-test-repo/blob/integration-test/imgbldr/env-is-persisted/.gitpod.Dockerfile#L3)
								CloneTaget: "integration-test/imgbldr/env-is-persisted",
								Config: &csapi.GitConfig{
									Authentication: csapi.GitAuthMethod_NO_AUTH,
								},
							},
						},
					},
				},
			},
		},
	}), integration.WithImageBuilderOpts(integration.SelectImageBuilderMK3))
	defer it.API().WorkspaceManager().StopWorkspace(ctx, &api.StopWorkspaceRequest{
		Id: res.Req.Id,
	})

	rsa, err := it.Instrument(integration.ComponentWorkspace, "workspace", integration.WithInstanceID(res.Req.Id))
	if err != nil {
		t.Fatal(err)
	}
	defer rsa.Close()

	var resp agent.ExecResponse
	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     "/workspace",
		Command: "bash",
		Args:    []string{"-c", "echo $MY_TEST_ENV_VAR"},
	}, &resp)
	if err != nil {
		t.Fatal(err)
	}
	if resp.ExitCode != 0 {
		t.Fatalf("got non-zero exit code: %d", resp.ExitCode)
	}
	if strings.TrimSpace(resp.Stdout) == "" {
		t.Fatalf("env var MY_TEST_ENV_VAR is not preserved!")
	}
}
