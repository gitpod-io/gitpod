// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"

	"golang.org/x/xerrors"
)

const (
	buildkitdSocketPath = "unix:///run/buildkit/buildkitd.sock"
)

// Builder builds images using buildkit
type Builder struct {
	Config *Config
}

// Build runs the actual image build
func (b *Builder) Build() error {
	var (
		teardown func() error = func() error { return nil }
		err      error
	)
	if b.Config.ExternalBuildkitd != "" {
		log.WithField("socketPath", b.Config.ExternalBuildkitd).Info("using external buildkit daemon")
		if err != nil {
			log.Warn("cannot connect to node-local buildkitd - falling back to pod-local one")
			teardown, err = StartBuildDaemon(buildkitdSocketPath)
		}
	} else {
		teardown, err = StartBuildDaemon(buildkitdSocketPath)
	}
	if err != nil {
		return err
	}
	defer teardown()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = b.buildBaseLayer(ctx)
	if err != nil {
		return err
	}
	err = b.buildWorkspaceImage(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (b *Builder) buildBaseLayer(ctx context.Context) error {
	if !b.Config.BuildBase {
		return nil
	}

	log.Info("building base image")
	return buildImage(ctx, b.Config.ContextDir, b.Config.Dockerfile, b.Config.WorkspaceLayerAuth, b.Config.BaseRef)
}

func (b *Builder) buildWorkspaceImage(ctx context.Context) (err error) {
	log.Info("building workspace image")

	tmpdir, err := ioutil.TempDir("", "wsbuild-*")
	if err != nil {
		return err
	}

	err = ioutil.WriteFile(filepath.Join(tmpdir, "Dockerfile"), []byte(fmt.Sprintf("FROM %v", b.Config.BaseRef)), 0644)
	if err != nil {
		return xerrors.Errorf("unexpected error creating temporal directory: %w", err)
	}

	return buildImage(ctx, tmpdir, "Dockerfile", b.Config.WorkspaceLayerAuth, b.Config.TargetRef)
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
