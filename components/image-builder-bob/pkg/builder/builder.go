// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"context"
	"errors"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/crane"

	"github.com/containerd/console"
	"github.com/containerd/containerd/reference"
	"github.com/moby/buildkit/client"
	"github.com/moby/buildkit/session"
	"github.com/moby/buildkit/util/progress/progressui"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
)

const (
	buildkitdSocketPath      = "unix:///run/buildkit/buildkitd.sock"
	maxConnectionAttempts    = 10
	initialConnectionTimeout = 2 * time.Second
)

// Builder builds images using buildkit
type Builder struct {
	Config *Config
}

// Build runs the actual image build
func (b *Builder) Build() error {
	var (
		cl       *client.Client
		teardown func() error = func() error { return nil }
		err      error
	)
	if b.Config.ExternalBuildkitd != "" {
		log.WithField("socketPath", b.Config.ExternalBuildkitd).Info("using external buildkit daemon")
		cl, err = connectToBuildkitd(b.Config.ExternalBuildkitd)

		if err != nil {
			log.Warn("cannot connect to node-local buildkitd - falling back to pod-local one")
			cl, teardown, err = StartBuildkit(buildkitdSocketPath)
		}
	} else {
		cl, teardown, err = StartBuildkit(buildkitdSocketPath)
	}
	if err != nil {
		return err
	}
	defer teardown()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = b.buildBaseLayer(ctx, cl)
	if err != nil {
		return err
	}
	err = b.buildWorkspaceImage(ctx, cl)
	if err != nil {
		return err
	}

	return nil
}

func (b *Builder) buildBaseLayer(ctx context.Context, cl *client.Client) error {
	if !b.Config.BuildBase {
		return nil
	}

	log.Info("waiting for build context")
	waitctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	err := waitForBuildContext(waitctx)
	if err != nil {
		return err
	}

	log.Info("building base image")

	var sess []session.Attachable
	if baselayerAuth := b.Config.BaseLayerAuth; baselayerAuth != "" {
		auth, err := newAuthProviderFromEnvvar(baselayerAuth)
		if err != nil {
			return xerrors.Errorf("invalid base layer authentication: %w", err)
		}
		sess = append(sess, auth)
	}

	contextdir := b.Config.ContextDir
	if contextdir == "" {
		contextdir = "."
	}
	solveOpt := client.SolveOpt{
		Frontend: "dockerfile.v0",
		FrontendAttrs: map[string]string{
			"filename": filepath.Base(b.Config.Dockerfile),
		},
		LocalDirs: map[string]string{
			"context":    contextdir,
			"dockerfile": filepath.Dir(b.Config.Dockerfile),
		},
		Session:      sess,
		CacheImports: b.Config.LocalCacheImport(),
	}

	eg, ectx := errgroup.WithContext(ctx)
	ch := make(chan *client.SolveStatus)
	eg.Go(func() error {
		_, err := cl.Solve(ectx, nil, solveOpt, ch)
		if err != nil {
			// buildkit errors are wrapped to contain the stack - that does not make for a pretty
			// sight when printing it to the user.
			if u := errors.Unwrap(err); u != nil {
				return u
			}

			return err
		}
		return nil
	})
	eg.Go(func() error {
		var c console.Console
		return progressui.DisplaySolveStatus(ectx, "", c, os.Stdout, ch)
	})
	err = eg.Wait()
	if err != nil {
		return err
	}

	// First we built the base, now we push the image by building it again.
	// We can't do this in one go because we cannot separate authentication for pull and push.
	// However we want separate authentication for pulling the FROM of base image builds and pushing
	// the built base images.
	solveOpt.Exports = []client.ExportEntry{
		{
			Type: "image",
			Attrs: map[string]string{
				"name": b.Config.BaseRef,
				"push": "true",
			},
		},
	}
	if lauth := b.Config.WorkspaceLayerAuth; lauth != "" {
		auth, err := newAuthProviderFromEnvvar(lauth)
		if err != nil {
			return xerrors.Errorf("invalid gp layer authentication: %w", err)
		}
		solveOpt.Session = []session.Attachable{auth}
	}
	eg, ectx = errgroup.WithContext(ctx)
	ch = make(chan *client.SolveStatus)
	eg.Go(func() error {
		_, err := cl.Solve(ectx, nil, solveOpt, ch)
		if err != nil {
			// buildkit errors are wrapped to contain the stack - that does not make for a pretty
			// sight when printing it to the user.
			if u := errors.Unwrap(err); u != nil {
				return u
			}

			return err
		}
		return nil
	})
	eg.Go(func() error {
		var c console.Console
		return progressui.DisplaySolveStatus(ectx, "", c, os.Stdout, ch)
	})
	err = eg.Wait()
	if err != nil {
		return err
	}

	log.Info("base image done")
	return err
}

func (b *Builder) buildWorkspaceImage(ctx context.Context, cl *client.Client) (err error) {
	// Workaround: buildkit/containerd currently does not support pushing multi-image builds
	//             with some registries, e.g. gcr.io. Until https://github.com/containerd/containerd/issues/5978
	//             is resolved, we'll manually copy the image.
	var craneOpts []crane.Option
	if gplayerAuth := b.Config.WorkspaceLayerAuth; gplayerAuth != "" {
		authorizer, err := NewAuthorizerFromEnvVar(gplayerAuth)
		if err != nil {
			return err
		}

		tref, err := reference.Parse(b.Config.TargetRef)
		if err != nil {
			return err
		}
		user, pass, err := authorizer.Authorize(tref.Hostname())
		if err != nil {
			return err
		}

		craneOpts = append(craneOpts, crane.WithAuth(authn.FromConfig(authn.AuthConfig{
			Username: user,
			Password: pass,
		})))
	}

	return crane.Copy(b.Config.BaseRef, b.Config.TargetRef, craneOpts...)

	// // Note: buildkit does not handle/export image config by default. That's why we need
	// //       to download it ourselves and explicitely export it.
	// //       See https://github.com/moby/buildkit/issues/2362 for details.
	// var sess []session.Attachable
	// if gplayerAuth := b.Config.WorkspaceLayerAuth; gplayerAuth != "" {
	// 	auth, err := newAuthProviderFromEnvvar(gplayerAuth)
	// 	if err != nil {
	// 		return err
	// 	}
	// 	sess = append(sess, auth)

	// 	authorizer, err := newDockerAuthorizerFromEnvvar(gplayerAuth)
	// 	if err != nil {
	// 		return err
	// 	}
	// 	resolver = docker.NewResolver(docker.ResolverOptions{
	// 		Authorizer: authorizer,
	// 	})
	// } else {
	// 	resolver = docker.NewResolver(docker.ResolverOptions{})
	// }

	// platform := specs.Platform{OS: "linux", Architecture: "amd64"}
	// _, cfg, err := imageutil.Config(ctx, b.Config.BaseRef, resolver, contentutil.NewBuffer(), nil, &platform)
	// if err != nil {
	// 	return err
	// }
	// state, err := llb.Image(b.Config.BaseRef).WithImageConfig(cfg)
	// if err != nil {
	// 	return err
	// }

	// def, err := state.Marshal(ctx, llb.Platform(platform))
	// if err != nil {
	// 	return err
	// }

	// // TODO(cw):
	// // buildkit does not support setting raw annotations yet (https://github.com/moby/buildkit/issues/1220).
	// // Once it does, we should set org.opencontainers.image.base.name as defined in https://github.com/opencontainers/image-spec/blob/main/annotations.md

	// solveOpt := client.SolveOpt{
	// 	Exports: []client.ExportEntry{
	// 		{
	// 			Type: "image",
	// 			Attrs: map[string]string{
	// 				"name":                  b.Config.TargetRef,
	// 				"push":                  "true",
	// 				"containerimage.config": string(cfg),
	// 			},
	// 		},
	// 	},
	// 	Session:      sess,
	// 	CacheImports: b.Config.LocalCacheImport(),
	// }

	// eg, ctx := errgroup.WithContext(ctx)
	// ch := make(chan *client.SolveStatus)
	// eg.Go(func() error {
	// 	_, err := cl.Solve(ctx, def, solveOpt, ch)
	// 	if err != nil {
	// 		return xerrors.Errorf("cannot build Gitpod layer: %w", err)
	// 	}
	// 	return nil
	// })
	// eg.Go(func() error {
	// 	var c console.Console
	// 	return progressui.DisplaySolveStatus(ctx, "", c, os.Stdout, ch)
	// })
	// return eg.Wait()
}

func waitForBuildContext(ctx context.Context) error {
	done := make(chan struct{})

	go func() {
		for {
			if ctx.Err() != nil {
				return
			}

			if _, err := os.Stat("/workspace/.gitpod/ready"); err != nil {
				continue
			}

			close(done)
			return
		}
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-done:
		return nil
	}
}

// StartBuildkit starts a local buildkit daemon
func StartBuildkit(socketPath string) (cl *client.Client, teardown func() error, err error) {
	stderr, err := ioutil.TempFile(os.TempDir(), "buildkitd_stderr")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
	}
	stdout, err := ioutil.TempFile(os.TempDir(), "buildkitd_stdout")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
	}

	cmd := exec.Command("buildkitd", "--addr="+socketPath, "--oci-worker-net=host", "--root=/workspace/buildkit")
	cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 0, Gid: 0}}
	cmd.Stderr = stderr
	cmd.Stdout = stdout
	err = cmd.Start()
	defer func() {
		if err == nil {
			return
		}

		if cmd.Process != nil {
			cmd.Process.Kill()
		}

		stderr.Seek(0, 0)
		stdout.Seek(0, 0)
		serr, _ := ioutil.ReadAll(stderr)
		sout, _ := ioutil.ReadAll(stdout)
		stderr.Close()
		stdout.Close()

		log.WithField("buildkitd-stderr", string(serr)).WithField("buildkitd-stdout", string(sout)).Error("buildkitd failure")
	}()
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot start buildkitd: %w", err)
	}

	teardown = func() error {
		err := cmd.Process.Kill()
		stdout.Close()
		stderr.Close()
		return err
	}
	cl, err = connectToBuildkitd(socketPath)
	if err != nil {
		return
	}

	return
}

func connectToBuildkitd(socketPath string) (cl *client.Client, err error) {
	for i := 0; i < maxConnectionAttempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), initialConnectionTimeout)

		log.WithField("attempt", i).Debug("attempting to connect to buildkitd")
		cl, err = client.New(ctx, socketPath, client.WithFailFast())
		if err != nil {
			if i == maxConnectionAttempts-1 {
				log.WithField("attempt", i).WithError(err).Warn("cannot connect to buildkitd")
			}

			cancel()
			time.Sleep(1 * time.Second)
			continue
		}

		_, err = cl.ListWorkers(ctx)
		if err != nil {
			if i == maxConnectionAttempts-1 {
				log.WithField("attempt", i).WithError(err).Error("cannot connect to buildkitd")
			}

			cancel()
			time.Sleep(1 * time.Second)
			continue
		}

		cancel()
		return
	}

	return nil, xerrors.Errorf("cannot connect to buildkitd")
}
