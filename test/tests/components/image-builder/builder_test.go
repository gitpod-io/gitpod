// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package imagebuilder

import (
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	imgapi "github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestBaseImageBuild(t *testing.T) {
	f := features.New("database").
		WithLabel("component", "image-builder").
		Assess("it should build a base image", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			client, err := api.ImageBuilder()
			if err != nil {
				t.Fatal("cannot start build", err)
			}

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
				if errors.Is(err, io.EOF) {
					break
				}

				if err != nil {
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
				t.Fatal("ref was empty")
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

func TestParallelBaseImageBuild(t *testing.T) {
	f := features.New("image-builder").
		WithLabel("component", "image-builder").
		Assess("it should allow parallel build of images", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			client, err := api.ImageBuilder()
			if err != nil {
				t.Fatalf("cannot start build: %q", err)
			}

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
				t.Fatalf("cannot start build: %v", err)
			}
			bld1, err := client.Build(ctx, req)
			if err != nil {
				t.Fatalf("cannot start build: %v", err)
			}

			watchBuild := func(cl imgapi.ImageBuilder_BuildClient) error {
				for {
					msg, err := cl.Recv()
					if errors.Is(err, io.EOF) {
						break
					}

					if err != nil {
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

			/*
				blds, err := client.ListBuilds(ctx, &imgapi.ListBuildsRequest{})
				if err != nil {
					t.Fatalf("cannot list builds: %v", err)
				}

					// TODO(cw): make this assertion resiliant against other on-going builds
					if l := len(blds.Builds); l != 1 {
						t.Errorf("image builder is running not just one build, but %d", l)
					}
			*/
			err = eg.Wait()
			if err != nil {
				t.Fatal(err)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
