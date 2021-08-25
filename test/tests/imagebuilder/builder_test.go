// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package imagerbuilder_test

import (
	"context"
	"fmt"
	"io"
	"testing"
	"time"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	imgapi "github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"golang.org/x/sync/errgroup"
)

func TestBaseImageBuild(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	client := it.API().ImageBuilder(integration.SelectImageBuilderMK3)
	bld, err := client.Build(ctx, &imgapi.BuildRequest{
		ForceRebuild: true,
		Source: &imgapi.BuildSource{
			From: &imgapi.BuildSource_File{
				File: &imgapi.BuildSourceDockerfile{
					DockerfileVersion: "some-version",
					DockerfilePath:    ".gitpod.Dockerfile",
					ContextPath:       ".",
					Source: &csapi.WorkspaceInitializer{
						Spec: &csapi.WorkspaceInitializer_Git{
							Git: &csapi.GitInitializer{
								RemoteUri:  "https://github.com/gitpod-io/dazzle.git",
								TargetMode: csapi.CloneTargetMode_REMOTE_BRANCH,
								CloneTaget: "main",
								Config: &csapi.GitConfig{
									Authentication: csapi.GitAuthMethod_NO_AUTH,
								},
							},
						},
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatal("cannot start build", err)
	}

	var ref string
	for {
		msg, err := bld.Recv()
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}

		ref = msg.Ref
		if msg.Status == imgapi.BuildStatus_done_success {
			break
		} else if msg.Status == imgapi.BuildStatus_done_failure {
			t.Fatalf("image build failed: %s", msg.Message)
		} else {
			t.Logf("build output: %s", msg.Message)
		}
	}
	if ref == "" {
		t.Error("ref was empty")
	}
}

func TestParallelBaseImageBuild(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	client := it.API().ImageBuilder(integration.SelectImageBuilderMK3)
	req := &imgapi.BuildRequest{
		ForceRebuild: true,
		Source: &imgapi.BuildSource{
			From: &imgapi.BuildSource_File{
				File: &imgapi.BuildSourceDockerfile{
					DockerfileVersion: "some-version",
					DockerfilePath:    ".gitpod.Dockerfile",
					ContextPath:       ".",
					Source: &csapi.WorkspaceInitializer{
						Spec: &csapi.WorkspaceInitializer_Git{
							Git: &csapi.GitInitializer{
								RemoteUri:  "https://github.com/gitpod-io/dazzle.git",
								TargetMode: csapi.CloneTargetMode_REMOTE_BRANCH,
								CloneTaget: "main",
								Config: &csapi.GitConfig{
									Authentication: csapi.GitAuthMethod_NO_AUTH,
								},
							},
						},
					},
				},
			},
		},
	}

	bld0, err := client.Build(ctx, req)
	if err != nil {
		t.Fatal("cannot start build", err)
		return
	}
	bld1, err := client.Build(ctx, req)
	if err != nil {
		t.Fatal("cannot start build", err)
		return
	}

	watchBuild := func(cl imgapi.ImageBuilder_BuildClient) error {
		for {
			msg, err := cl.Recv()
			if err != nil && err != io.EOF {
				return xerrors.Errorf("image builder error: %v", err)
			}
			if err := ctx.Err(); err != nil {
				return xerrors.Errorf("context error: %v", err)
			}

			if msg.Status == imgapi.BuildStatus_done_success {
				break
			} else if msg.Status == imgapi.BuildStatus_done_failure {
				return xerrors.Errorf("image build failed: %s", msg.Message)
			} else {
				t.Logf("build output: %s", msg.Message)
			}
		}
		return nil
	}

	var eg errgroup.Group
	eg.Go(func() error { return watchBuild(bld0) })
	eg.Go(func() error { return watchBuild(bld1) })

	blds, err := client.ListBuilds(ctx, &imgapi.ListBuildsRequest{})
	if err != nil {
		t.Fatal("cannot list builds", err)
	}

	// TODO(cw): make this assertion resiliant against other on-going builds
	if l := len(blds.Builds); l != 1 {
		t.Errorf("image builder is running not just one build, but %d", l)
	}

	err = eg.Wait()
	if err != nil {
		t.Fatal(err)
	}
}
