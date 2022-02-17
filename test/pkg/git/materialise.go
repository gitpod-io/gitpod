// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// TODO(cw)
//   - add API to get the repo context URL
//   - add API to get a content initialier from the materialised repo

package git

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-billy/v5/memfs"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/storage/memory"
	"github.com/google/go-github/v42/github"
	"golang.org/x/oauth2"
	"golang.org/x/xerrors"
)

// DefaultBranch is the default branch this package is using
const DefaultBranch = plumbing.Master

// TempRepo produces a repo spec with a temporary name
func TempRepo(private bool) RepoSpec {
	return RepoSpec{
		Name:    fmt.Sprintf("testing-%d-%d", time.Now().Unix(), rand.Int()),
		Private: private,
	}
}

// RepoSpec specifies a repository
type RepoSpec struct {
	Name    string
	Private bool
}

// Ops build a repo
type Ops []Op

func (ops Ops) Materialise(repo *git.Repository) error {
	w, err := repo.Worktree()
	if err != nil {
		return err
	}

	for _, op := range ops {
		err = op(repo, w)
		if err != nil {
			return err
		}
	}

	return nil
}

// Op modifies a repo
type Op func(r *git.Repository, w *git.Worktree) error

// OpCheckoutAfterCreate creates a branch ands checks it out
func OpCheckoutAfterCreate(branch string) Op {
	return func(r *git.Repository, w *git.Worktree) error {
		headRef, err := r.Head()
		if err != nil {
			return xerrors.Errorf("no head ref: %w", err)
		}
		fqn := plumbing.NewBranchReferenceName(branch)
		err = r.Storer.SetReference(plumbing.NewHashReference(fqn, headRef.Hash()))
		if err != nil {
			return xerrors.Errorf("cannot create branch %s: %w", fqn, err)
		}

		return w.Checkout(&git.CheckoutOptions{
			Branch: fqn,
		})
	}
}

// OpCheckout checks out a branch
func OpCheckout(branch string) Op {
	return func(r *git.Repository, w *git.Worktree) error {
		fqn := plumbing.NewBranchReferenceName(branch)
		return w.Checkout(&git.CheckoutOptions{
			Branch: fqn,
		})
	}
}

// OpCommit commits all staged files
func OpCommit(message string) Op {
	return func(r *git.Repository, w *git.Worktree) error {
		_, err := w.Commit(message, &git.CommitOptions{})
		return err
	}
}

// OpCommitAll commits all files
func OpCommitAll(message string) Op {
	return func(r *git.Repository, w *git.Worktree) error {
		_, err := w.Commit(message, &git.CommitOptions{
			All: true,
		})
		return err
	}
}

// OpAddFile adds a new file to the repo. The parent directories
// of the file don't neccesarily have to exist. Use relative paths.
func OpAddFile(fn, content string) Op {
	return func(r *git.Repository, w *git.Worktree) error {
		if filepath.IsAbs(fn) {
			return xerrors.Errorf("path must be relative: %s", fn)
		}

		fp, err := w.Filesystem.Create(fn)
		if err != nil {
			return xerrors.Errorf("cannot create file %s: %w", fn, err)
		}
		n, err := fp.Write([]byte(content))
		if err != nil {
			return xerrors.Errorf("cannot write file %s: %w", fn, err)
		}
		if n != len(content) {
			return xerrors.Errorf("%s: %v", fn, io.ErrShortWrite)
		}
		err = fp.Close()
		if err != nil {
			return xerrors.Errorf("cannot close file %s: %w", fn, err)
		}
		_, err = w.Add(fn)
		if err != nil {
			return xerrors.Errorf("cannot add file %s: %w", fn, err)
		}
		return nil
	}
}

// MaterialisedGitHubRepo is a repo that was created on GitHub
type MaterialisedGitHubRepo struct {
	Local  *MaterialisedRepo
	Remote *github.Repository

	gh *github.Client
}

// Delete removes the materialised repo from GitHub
func (r *MaterialisedGitHubRepo) Delete(ctx context.Context) error {
	_, err := r.gh.Repositories.Delete(ctx, *r.Remote.Owner.Login, *r.Remote.Name)
	return err
}

// ContextURL returns the context URL of the repo
func (r *MaterialisedGitHubRepo) ContextURL() string {
	return r.gh.BaseURL.String()
}

// CloneURL returns the git clone URL of the repo
func (r *MaterialisedGitHubRepo) CloneURL() string {
	return *r.Remote.CloneURL
}

// MaterialisedRepo is a repo that was created for testing purposes
type MaterialisedRepo struct {
	*git.Repository
}

// MaterialiseToGitHub creates a new repo on GitHub and pushes the spec to it
func MaterialiseToGitHub(ctx context.Context, token, org string, repoSpec RepoSpec, spec Ops) (res *MaterialisedGitHubRepo, err error) {
	repo, err := git.Init(memory.NewStorage(), memfs.New())
	if err != nil {
		return nil, xerrors.Errorf("cannot create in-memory repo: %w", err)
	}
	err = spec.Materialise(repo)
	if err != nil {
		return nil, xerrors.Errorf("cannot materialise in-memory repo: %w", err)
	}

	gh := github.NewClient(oauth2.NewClient(ctx, oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})))
	desc := "integration test repo - THIS REPO WAS AUOTMATICALLY PRODUCED AND SHOULD NOT BE MODIFIED"
	ghRepo, _, err := gh.Repositories.Create(ctx, org, &github.Repository{
		Name:        &repoSpec.Name,
		Description: &desc,
		Private:     &repoSpec.Private,
	})
	if err != nil {
		return nil, xerrors.Errorf("cannot create GitHub repo: %w", err)
	}

	_, err = repo.CreateRemote(&config.RemoteConfig{
		Name: "origin",
		URLs: []string{*ghRepo.CloneURL},
	})
	if err != nil {
		return nil, xerrors.Errorf("cannot update remotes: %w", err)
	}

	for i := 0; i < 12; i++ {
		err = repo.PushContext(ctx, &git.PushOptions{
			Auth: &http.BasicAuth{
				Username: "Bearer",
				Password: token,
			},
		})
		if err == nil {
			break
		}
		if errors.Is(err, git.NoErrAlreadyUpToDate) {
			// we're good
			err = nil
			break
		}
		if strings.Contains(err.Error(), "repository not found") {
			// repo was not created yet - try again
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			time.Sleep(5 * time.Second)
		}
	}
	if err != nil {
		return nil, xerrors.Errorf("cannot push to GitHub: %w", err)
	}

	return &MaterialisedGitHubRepo{
		Local:  &MaterialisedRepo{repo},
		Remote: ghRepo,
		gh:     gh,
	}, nil
}

// MaterialiseToDisk produces a Git repo on disk
func MaterialiseToDisk(dst string, spec Ops) (repo *git.Repository, err error) {
	if _, err := os.Stat(dst); os.IsNotExist(err) {
		err = os.MkdirAll(dst, 0755)
		if err != nil {
			return nil, err
		}
		repo, err = git.PlainInit(dst, false)
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		repo, err = git.PlainOpen(dst)
		if err != nil {
			return nil, err
		}
	}

	err = spec.Materialise(repo)
	if err != nil {
		return nil, err
	}

	return repo, nil
}
