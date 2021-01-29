// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"os"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	"github.com/opentracing/opentracing-go"
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
}

// Run initializes the workspace using Git
func (ws *GitInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, err error) {
	isGitWS := git.IsWorkingCopy(ws.Location)

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
	span, ctx := opentracing.StartSpanFromContext(ctx, "realizeCloneTarget")
	span.SetTag("remoteURI", ws.RemoteURI)
	span.SetTag("cloneTarget", ws.CloneTarget)
	span.SetTag("targetMode", ws.TargetMode)
	defer tracing.FinishSpan(span, &err)

	// checkout branch
	if ws.TargetMode == RemoteBranch {
		// create local branch based on remote
		if err := ws.Git(ctx, "checkout", "-B", ws.CloneTarget, "origin/"+ws.CloneTarget); err != nil {
			return err
		}
	} else if ws.TargetMode == LocalBranch {
		if err := ws.Git(ctx, "checkout", "-b", ws.CloneTarget); err != nil {
			return err
		}
	} else if ws.TargetMode == RemoteCommit {
		// checkout specific commit
		if err := ws.Git(ctx, "checkout", ws.CloneTarget); err != nil {
			return err
		}
	} else { //nolint:staticcheck
		// nothing to do - we're already on the remote branch
	}
	return nil
}
