// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"fmt"
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

	envVarName := "MY_TEST_ENV_VAR"
	envVarValue := "asd"
	res := integration.LaunchWorkspaceDirectly(it, integration.WithWorkspaceImageRequest(&imgapi.ResolveWorkspaceImageRequest{
		Source: &imgapi.BuildSource{
			From: &imgapi.BuildSource_File{
				File: &imgapi.BuildSourceDockerfile{
					DockerfileVersion: "some-version",
					DockerfilePath:    ".gitpod.Dockerfile",
					ContextPath:       ".",
					Source: &csapi.WorkspaceInitializer{
						Spec: &csapi.WorkspaceInitializer_Files{
							Files: &csapi.FilesInitializer{
								Files: []*csapi.FilesInitializer_File{
									{
										Content:  fmt.Sprintf("FROM gitpod/workspace-full\nENV %s=%s", envVarName, envVarValue),
										FilePath: ".gitpod.Dockerfile",
									},
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
		Args:    []string{"-c", fmt.Sprintf("echo $%s", envVarName)},
	}, &resp)
	if err != nil {
		t.Fatal(err)
	}
	if resp.ExitCode != 0 {
		t.Fatalf("got non-zero exit code: %d", resp.ExitCode)
	}
	if strings.TrimSpace(resp.Stdout) == "" {
		t.Fatalf("env var %s is not preserved!", envVarName)
	}
}
