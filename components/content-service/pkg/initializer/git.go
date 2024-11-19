// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/cenkalti/backoff"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/process"
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
func (ws *GitInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, stats csapi.InitializerMetrics, err error) {
	isGitWS := git.IsWorkingCopy(ws.Location)
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "GitInitializer.Run")
	span.SetTag("isGitWS", isGitWS)
	defer tracing.FinishSpan(span, &err)
	start := time.Now()
	initialSize, fsErr := getFsUsage()
	if fsErr != nil {
		log.WithError(fsErr).Error("could not get disk usage")
	}

	src = csapi.WorkspaceInitFromOther
	if isGitWS {
		log.WithField("stage", "init").WithField("location", ws.Location).Info("Not running git clone. Workspace is already a Git workspace")
		return
	}

	gitClone := func() error {
		if err := os.MkdirAll(ws.Location, 0775); err != nil {
			log.WithError(err).WithField("location", ws.Location).Error("cannot create directory")
			return err
		}

		// make sure that folder itself is owned by gitpod user prior to doing git clone
		// this is needed as otherwise git clone will fail if the folder is owned by root
		if ws.RunAsGitpodUser {
			args := []string{"gitpod", ws.Location}
			cmd := exec.Command("chown", args...)
			res, cerr := cmd.CombinedOutput()
			if cerr != nil && !process.IsNotChildProcess(cerr) {
				err = git.OpFailedError{
					Args:       args,
					ExecErr:    cerr,
					Output:     string(res),
					Subcommand: "chown",
				}
				return err
			}
		}

		log.WithField("stage", "init").WithField("location", ws.Location).Debug("Running git clone on workspace")
		err = ws.Clone(ctx)
		if err != nil {
			if strings.Contains(err.Error(), "Access denied") {
				err = &backoff.PermanentError{
					Err: fmt.Errorf("Access denied. Please check that Gitpod was given permission to access the repository"),
				}
			}

			return err
		}

		// we can only do `git config` stuffs after having a directory that is also git init'd
		// commit-graph after every git fetch command that downloads a pack-file from a remote
		err = ws.Git(ctx, "config", "fetch.writeCommitGraph", "true")
		if err != nil {
			log.WithError(err).WithField("location", ws.Location).Error("cannot configure fetch.writeCommitGraph")
		}

		err = ws.Git(ctx, "config", "--replace-all", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*")
		if err != nil {
			log.WithError(err).WithField("location", ws.Location).Error("cannot configure fetch behavior")
		}

		err = ws.Git(ctx, "config", "--replace-all", "checkout.defaultRemote", "origin")
		if err != nil {
			log.WithError(err).WithField("location", ws.Location).Error("cannot configure checkout defaultRemote")
		}

		return nil
	}
	onGitCloneFailure := func(e error, d time.Duration) {
		if err := os.RemoveAll(ws.Location); err != nil {
			log.
				WithField("stage", "init").
				WithField("location", ws.Location).
				WithError(err).
				Error("Cleaning workspace location failed.")
		}
		log.
			WithField("stage", "init").
			WithField("location", ws.Location).
			WithField("sleepTime", d).
			WithError(e).
			Debugf("Running git clone on workspace failed. Retrying in %s ...", d)
	}

	b := backoff.NewExponentialBackOff()
	b.MaxElapsedTime = 5 * time.Minute
	if err = backoff.RetryNotify(gitClone, b, onGitCloneFailure); err != nil {
		err = checkGitStatus(err)
		return src, nil, xerrors.Errorf("git initializer gitClone: %w", err)
	}

	defer func() {
		span.SetTag("Chown", ws.Chown)
		if !ws.Chown {
			return
		}
		// TODO (aledbf): refactor to remove the need of manual chown
		args := []string{"-R", "-L", "gitpod", ws.Location}
		cmd := exec.Command("chown", args...)
		res, cerr := cmd.CombinedOutput()
		if cerr != nil && !process.IsNotChildProcess(cerr) {
			err = git.OpFailedError{
				Args:       args,
				ExecErr:    cerr,
				Output:     string(res),
				Subcommand: "chown",
			}
			return
		}
	}()

	if err := ws.realizeCloneTarget(ctx); err != nil {
		return src, nil, xerrors.Errorf("git initializer clone: %w", err)
	}
	if err := ws.UpdateRemote(ctx); err != nil {
		return src, nil, xerrors.Errorf("git initializer updateRemote: %w", err)
	}
	if err := ws.UpdateSubmodules(ctx); err != nil {
		log.WithError(err).Warn("error while updating submodules - continuing")
	}

	log.WithField("stage", "init").WithField("location", ws.Location).Debug("Git operations complete")

	if fsErr == nil {
		currentSize, fsErr := getFsUsage()
		if fsErr != nil {
			log.WithError(fsErr).Error("could not get disk usage")
		}

		stats = csapi.InitializerMetrics{csapi.InitializerMetric{
			Type:     "git",
			Duration: time.Since(start),
			Size:     currentSize - initialSize,
		}}
	}
	return
}

func (ws *GitInitializer) isShallowRepository(ctx context.Context) bool {
	out, err := ws.GitWithOutput(ctx, nil, "rev-parse", "--is-shallow-repository")
	if err != nil {
		log.WithError(err).Error("unexpected error checking if git repository is shallow")
		return true
	}
	isShallow, err := strconv.ParseBool(strings.TrimSpace(string(out)))
	if err != nil {
		log.WithError(err).WithField("input", string(out)).Error("unexpected error parsing bool")
		return true
	}
	return isShallow
}

// realizeCloneTarget ensures the clone target is checked out
func (ws *GitInitializer) realizeCloneTarget(ctx context.Context) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "realizeCloneTarget")
	span.SetTag("remoteURI", ws.RemoteURI)
	span.SetTag("cloneTarget", ws.CloneTarget)
	span.SetTag("targetMode", ws.TargetMode)
	defer tracing.FinishSpan(span, &err)

	defer func() {
		err = checkGitStatus(err)
	}()

	// checkout branch
	switch ws.TargetMode {
	case RemoteBranch:
		// confirm the value of the default branch name using rev-parse
		gitout, _ := ws.GitWithOutput(ctx, nil, "rev-parse", "--abbrev-ref", "origin/HEAD")
		defaultBranch := strings.TrimSpace(strings.Replace(string(gitout), "origin/", "", -1))

		branchName := ws.CloneTarget

		// we already cloned the git repository but we need to check CloneTarget exists
		// to avoid calling fetch from a non-existing branch
		gitout, err := ws.GitWithOutput(ctx, nil, "ls-remote", "--exit-code", "origin", ws.CloneTarget)
		if err != nil || len(gitout) == 0 {
			log.WithField("remoteURI", ws.RemoteURI).WithField("branch", ws.CloneTarget).Warnf("Invalid default branch name. Changing to %v", defaultBranch)
			ws.CloneTarget = defaultBranch
		}

		// No need to prune here because we fetch the specific branch only. If we were to try and fetch everything,
		// we might end up trying to fetch at tag/branch which has since been recreated. It's exactly the specific
		// fetch wich prevents this situation.
		//
		// We don't recurse submodules because callers realizeCloneTarget() are expected to update submodules explicitly,
		// and deal with any error appropriately (i.e. emit a warning rather than fail).
		fetchArgs := []string{"--depth=1", "origin", "--recurse-submodules=no", ws.CloneTarget}
		isShallow := ws.isShallowRepository(ctx)
		if !isShallow {
			fetchArgs = []string{"origin", "--recurse-submodules=no", ws.CloneTarget}
		}
		if err := ws.Git(ctx, "fetch", fetchArgs...); err != nil {
			log.WithError(err).WithField("isShallow", isShallow).WithField("remoteURI", ws.RemoteURI).WithField("branch", ws.CloneTarget).Error("Cannot fetch remote branch")
			return err
		}

		if err := ws.Git(ctx, "-c", "core.hooksPath=/dev/null", "checkout", "-B", branchName, "origin/"+ws.CloneTarget); err != nil {
			log.WithError(err).WithField("remoteURI", ws.RemoteURI).WithField("branch", branchName).Error("Cannot fetch remote branch")
			return err
		}
	case LocalBranch:
		// checkout local branch based on remote HEAD
		if err := ws.Git(ctx, "-c", "core.hooksPath=/dev/null", "checkout", "-B", ws.CloneTarget, "origin/HEAD", "--no-track"); err != nil {
			return err
		}
	case RemoteCommit:
		// We did a shallow clone before, hence need to fetch the commit we are about to check out.
		// Because we don't want to make the "git fetch" mechanism in supervisor more complicated,
		// we'll just fetch the 20 commits right away.
		if err := ws.Git(ctx, "fetch", "origin", ws.CloneTarget, "--depth=20"); err != nil {
			return err
		}

		// checkout specific commit
		if err := ws.Git(ctx, "-c", "core.hooksPath=/dev/null", "checkout", ws.CloneTarget); err != nil {
			return err
		}
	default:
		// update to remote HEAD
		if _, err := ws.GitWithOutput(ctx, nil, "reset", "--hard", "origin/HEAD"); err != nil {
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

func checkGitStatus(err error) error {
	if err != nil {
		if strings.Contains(err.Error(), "The requested URL returned error: 524") {
			return fmt.Errorf("Git clone returned HTTP status 524 (see https://gitlab.com/gitlab-com/gl-infra/reliability/-/issues/8475). Please try restarting your workspace")
		}
	}

	return err
}
