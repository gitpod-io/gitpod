// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/opentracing/opentracing-go"
	tracelog "github.com/opentracing/opentracing-go/log"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
)

// PrebuildInitializer first tries to restore the snapshot/prebuild and if that succeeds performs Git operations.
// If restoring the prebuild does not succeed we fall back to Git entriely.
type PrebuildInitializer struct {
	Git      []*GitInitializer
	Prebuild *SnapshotInitializer
}

// Run runs the prebuild initializer
func (p *PrebuildInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "PrebuildInitializer")
	defer tracing.FinishSpan(span, &err)

	var spandata []tracelog.Field
	if p.Prebuild == nil {
		spandata = append(spandata, tracelog.Bool("hasSnapshot", false))
	} else {
		spandata = append(spandata,
			tracelog.Bool("hasSnapshot", true),
			tracelog.String("snapshot", p.Prebuild.Snapshot),
		)
	}
	if len(p.Git) == 0 {
		spandata = append(spandata, tracelog.Bool("hasGit", false))
	} else {
		spandata = append(spandata,
			tracelog.Bool("hasGit", true),
		)
	}
	span.LogFields(spandata...)

	if p.Prebuild != nil {
		var (
			snapshot = p.Prebuild.Snapshot
			location = p.Prebuild.Location
			log      = log.WithField("location", p.Prebuild.Location)
		)
		_, err = p.Prebuild.Run(ctx, mappings)
		if err != nil {
			log.WithError(err).Warnf("prebuilt init was unable to restore snapshot %s. Resorting the regular Git init", snapshot)

			if err := clearWorkspace(location); err != nil {
				return csapi.WorkspaceInitFromOther, xerrors.Errorf("prebuild initializer: %w", err)
			}

			for _, gi := range p.Git {
				_, err = gi.Run(ctx, mappings)
				if err != nil {
					return csapi.WorkspaceInitFromOther, xerrors.Errorf("prebuild initializer: Git fallback: %w", err)
				}
			}
		}
	}

	// at this point we're actually a prebuild initialiser because we've been able to restore
	// the prebuild.
	src = csapi.WorkspaceInitFromPrebuild

	// make sure we're on the correct branch
	for _, gi := range p.Git {
		err = runGitInit(ctx, gi)
		if err != nil {
			return src, err
		}
	}
	log.Debug("Initialized workspace with prebuilt snapshot")
	return
}

func clearWorkspace(location string) error {
	files, err := filepath.Glob(filepath.Join(location, "*"))
	if err != nil {
		return err
	}
	for _, file := range files {
		err = os.RemoveAll(file)
		if err != nil {
			return xerrors.Errorf("prebuild initializer: %w", err)
		}
	}
	return nil
}

func runGitInit(ctx context.Context, gInit *GitInitializer) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "runGitInit")
	span.LogFields(
		tracelog.String("IsWorkingCopy", fmt.Sprintf("%v", git.IsWorkingCopy(gInit.Location))),
		tracelog.String("location", fmt.Sprintf("%v", gInit.Location)),
	)
	if git.IsWorkingCopy(gInit.Location) {
		out, err := gInit.GitWithOutput(ctx, "stash", "push", "-u")
		if err != nil {
			var giterr git.OpFailedError
			if errors.As(err, &giterr) && strings.Contains(giterr.Output, "You do not have the initial commit yet") {
				// git stash push returns a non-zero exit code if the repository does not have a single commit.
				// In this case that's not an error though, hence we don't want to fail here.
			} else {
				// git returned a non-zero exit code because of some reason we did not anticipate or an actual failure.
				return xerrors.Errorf("prebuild initializer: %w", err)
			}
		}
		didStash := !strings.Contains(string(out), "No local changes to save")

		err = gInit.Fetch(ctx)
		if err != nil {
			return xerrors.Errorf("prebuild initializer: %w", err)
		}
		err = gInit.realizeCloneTarget(ctx)
		if err != nil {
			return xerrors.Errorf("prebuild initializer: %w", err)
		}

		// If any of these cleanup operations fail that's no reason to fail ws initialization.
		// It just results in a slightly degraded state.
		if didStash {
			err = gInit.Git(ctx, "stash", "pop")
			if err != nil {
				// If restoring the stashed changes produces merge conflicts on the new Git ref, simply
				// throw them away (they'll remain in the stash, but are likely outdated anyway).
				_ = gInit.Git(ctx, "reset", "--hard")
			}
		}

		log.Debug("prebuild initializer Git operations complete")
	}
	return nil
}
