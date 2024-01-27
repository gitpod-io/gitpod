// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

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
func (p *PrebuildInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, stats csapi.InitializerMetrics, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "PrebuildInitializer")
	defer tracing.FinishSpan(span, &err)
	startTime := time.Now()
	initialSize, fsErr := getFsUsage()
	if fsErr != nil {
		log.WithError(fsErr).Error("could not get disk usage")
	}

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
		_, s, err := p.Prebuild.Run(ctx, mappings)
		if err == nil {
			stats = append(stats, s...)
		}

		if err != nil {
			log.WithError(err).Warnf("prebuilt init was unable to restore snapshot %s. Resorting the regular Git init", snapshot)

			if err := clearWorkspace(location); err != nil {
				return csapi.WorkspaceInitFromOther, nil, xerrors.Errorf("prebuild initializer: %w", err)
			}

			for _, gi := range p.Git {
				_, s, err := gi.Run(ctx, mappings)
				if err != nil {
					return csapi.WorkspaceInitFromOther, nil, xerrors.Errorf("prebuild initializer: Git fallback: %w", err)
				}
				stats = append(stats, s...)
			}
		}
	}

	// at this point we're actually a prebuild initialiser because we've been able to restore
	// the prebuild.

	src = csapi.WorkspaceInitFromPrebuild

	// make sure we're on the correct branch
	for _, gi := range p.Git {

		commitChanged, err := runGitInit(ctx, gi)
		if err != nil {
			return src, nil, err
		}
		if commitChanged {
			// head commit has changed, so it's an outdated prebuild, which we treat as other
			src = csapi.WorkspaceInitFromOther
		}
	}
	log.Debug("Initialized workspace with prebuilt snapshot")

	if fsErr == nil {
		currentSize, fsErr := getFsUsage()
		if fsErr != nil {
			log.WithError(fsErr).Error("could not get disk usage")
		}

		stats = append(stats, csapi.InitializerMetric{
			Type:     "prebuild",
			Duration: time.Since(startTime),
			Size:     currentSize - initialSize,
		})
	}

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

func runGitInit(ctx context.Context, gInit *GitInitializer) (commitChanged bool, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "runGitInit")
	span.LogFields(
		tracelog.String("IsWorkingCopy", fmt.Sprintf("%v", git.IsWorkingCopy(gInit.Location))),
		tracelog.String("location", fmt.Sprintf("%v", gInit.Location)),
	)
	defer tracing.FinishSpan(span, &err)
	if git.IsWorkingCopy(gInit.Location) {
		out, err := gInit.GitWithOutput(ctx, nil, "stash", "push", "--no-include-untracked")
		if err != nil {
			var giterr git.OpFailedError
			if errors.As(err, &giterr) && strings.Contains(giterr.Output, "You do not have the initial commit yet") {
				// git stash push returns a non-zero exit code if the repository does not have a single commit.
				// In this case that's not an error though, hence we don't want to fail here.
			} else {
				// git returned a non-zero exit code because of some reason we did not anticipate or an actual failure.
				log.WithError(err).WithField("output", string(out)).Error("unexpected git stash error")
				return commitChanged, xerrors.Errorf("prebuild initializer: %w", err)
			}
		}
		didStash := !strings.Contains(string(out), "No local changes to save")

		statusBefore, err := gInit.Status(ctx)
		if err != nil {
			log.WithError(err).Warn("couldn't run git status - continuing")
		}
		err = checkGitStatus(gInit.realizeCloneTarget(ctx))
		if err != nil {
			return commitChanged, xerrors.Errorf("prebuild initializer: %w", err)
		}
		statusAfter, err := gInit.Status(ctx)
		if err != nil {
			log.WithError(err).Warn("couldn't run git status - continuing")
		}
		if statusBefore != nil && statusAfter != nil {
			commitChanged = statusBefore.LatestCommit != statusAfter.LatestCommit
		}

		err = gInit.UpdateSubmodules(ctx)
		if err != nil {
			log.WithError(err).Warn("error while updating submodules from prebuild initializer - continuing")
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

	return commitChanged, nil
}
