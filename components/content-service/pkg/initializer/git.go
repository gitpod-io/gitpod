// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strings"

	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
)

// CloneTargetMode is the target state in which we want to leave a GitInitializer
type CloneTargetMode string

const (
	// RemoteHead has the local WS point at the remote branch head
	RemoteHead CloneTargetMode = "head"

	// RemoteCommit has the local WS point at a specific commit
	RemoteCommit CloneTargetMode = "commit"

	// RemoteBranch has the local WS point at a remote branch
	RemoteBranch CloneTargetMode = "remote-branch"

	// LocalBranch creates a local branch in the workspace
	LocalBranch CloneTargetMode = "local-branch"
)

// GitInitializer is a local workspace with a Git connection
type GitInitializer struct {
	git.Client

	// The target mode determines what gets checked out
	TargetMode CloneTargetMode

	// The value for the clone target mode - use depends on the target mode
	CloneTarget string

	// If true, the Git initializer will chown(gitpod) after the clone
	Chown bool
}

// Run initializes the workspace using Git
func (ws *GitInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, err error) {
	isGitWS := git.IsWorkingCopy(ws.Location)
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "GitInitializer.Run")
	span.SetTag("isGitWS", isGitWS)
	defer tracing.FinishSpan(span, &err)

	src = csapi.WorkspaceInitFromOther
	if isGitWS {
		log.WithField("stage", "init").WithField("location", ws.Location).Info("Not running git clone. Workspace is already a Git workspace")
		return
	}

	if err := os.MkdirAll(ws.Location, 0770); err != nil {
		return src, xerrors.Errorf("git initializer: %w", err)
	}

	log.WithField("stage", "init").WithField("location", ws.Location).Debug("Running git clone on workspace")
	if err := ws.Clone(ctx); err != nil {
		return src, xerrors.Errorf("git initializer: %w", err)
	}
	if ws.Chown {
		// TODO (aledbf): refactor to remove the need of manual chown
		args := []string{"-R", "-L", "gitpod", ws.Location}
		cmd := exec.Command("chown", args...)
		res, cerr := cmd.CombinedOutput()
		if cerr != nil && !(cerr.Error() == "wait: no child processes" || cerr.Error() == "waitid: no child processes") {
			err = git.OpFailedError{
				Args:       args,
				ExecErr:    cerr,
				Output:     string(res),
				Subcommand: "chown",
			}
			return
		}
	}
	if err := ws.realizeCloneTarget(ctx); err != nil {
		return src, xerrors.Errorf("git initializer: %w", err)
	}
	if err := ws.UpdateRemote(ctx); err != nil {
		return src, xerrors.Errorf("git initializer: %w", err)
	}
	if err := ws.UpdateSubmodules(ctx); err != nil {
		log.WithError(err).Warn("error while updating submodules - continuing")
	}

	log.WithField("stage", "init").WithField("location", ws.Location).Info("Git operations complete")
	return
}

// realizeCloneTarget ensures the clone target is checked out
func (ws *GitInitializer) realizeCloneTarget(ctx context.Context) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "realizeCloneTarget")
	span.SetTag("remoteURI", ws.RemoteURI)
	span.SetTag("cloneTarget", ws.CloneTarget)
	span.SetTag("targetMode", ws.TargetMode)
	defer tracing.FinishSpan(span, &err)

	// checkout branch
	if ws.TargetMode == RemoteBranch {
		// create local branch based on specific remote branch
		if err := ws.Git(ctx, "checkout", "-B", ws.CloneTarget, "origin/"+ws.CloneTarget); err != nil {
			return err
		}
	} else if ws.TargetMode == LocalBranch {
		// checkout local branch based on remote HEAD
		if err := ws.Git(ctx, "checkout", "-B", ws.CloneTarget, "origin/HEAD"); err != nil {
			return err
		}
	} else if ws.TargetMode == RemoteCommit {
		// checkout specific commit
		if err := ws.Git(ctx, "checkout", ws.CloneTarget); err != nil {
			return err
		}
	} else {
		// update to remote HEAD
		if _, err := ws.GitWithOutput(ctx, "reset", "--hard", "origin/HEAD"); err != nil {
			var giterr git.OpFailedError
			if errors.As(err, &giterr) && strings.Contains(giterr.Output, "unknown revision or path not in the working tree") {
				// 'git reset --hard origin/HEAD' returns a non-zero exit code if origin does not have a single commit (empty repository).
				// In this case that's not an error though, hence we don't want to fail here.
			} else {
				return err
			}
		}
	}
	return nil
}
