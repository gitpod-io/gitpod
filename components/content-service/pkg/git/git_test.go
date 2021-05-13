// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package git

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"golang.org/x/xerrors"
)

const (
	notEmpty = "not-empty"
)

func TestGitStatus(t *testing.T) {
	tests := []struct {
		Name   string
		Prep   func(context.Context, *Client) error
		Result *Status
		Error  error
	}{
		{
			"no commits",
			func(ctx context.Context, c *Client) error {
				if err := c.Git(ctx, "init"); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchOID:  "(initial)",
					BranchHead: "master",
				},
			},
			nil,
		},
		{
			"clean copy",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead: "master",
					BranchOID:  notEmpty,
				},
				LatestCommit: notEmpty,
			},
			nil,
		},
		{
			"untracked files",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := os.WriteFile(filepath.Join(c.Location, "another-file"), []byte{}, 0755); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead:     "master",
					BranchOID:      notEmpty,
					UntrackedFiles: []string{"another-file"},
				},
				LatestCommit: notEmpty,
			},
			nil,
		},
		{
			"uncommitted files",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := os.WriteFile(filepath.Join(c.Location, "first-file"), []byte("foobar"), 0755); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead:      "master",
					BranchOID:       notEmpty,
					UncommitedFiles: []string{"first-file"},
				},
				LatestCommit: notEmpty,
			},
			nil,
		},
		{
			"unpushed commits",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := os.WriteFile(filepath.Join(c.Location, "first-file"), []byte("foobar"), 0755); err != nil {
					return err
				}
				if err := c.Git(ctx, "commit", "-a", "-m", "foo"); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead: "master",
					BranchOID:  notEmpty,
				},
				UnpushedCommits: []string{notEmpty},
				LatestCommit:    notEmpty,
			},
			nil,
		},
		{
			"unpushed commits in new branch",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := c.Git(ctx, "checkout", "-b", "otherbranch"); err != nil {
					return err
				}
				if err := os.WriteFile(filepath.Join(c.Location, "first-file"), []byte("foobar"), 0755); err != nil {
					return err
				}
				if err := c.Git(ctx, "commit", "-a", "-m", "foo"); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead: "otherbranch",
					BranchOID:  notEmpty,
				},
				UnpushedCommits: []string{notEmpty},
				LatestCommit:    notEmpty,
			},
			nil,
		},

		{
			"pending in sub-dir files",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := os.MkdirAll(filepath.Join(c.Location, "this/is/a/nested/test"), 0755); err != nil {
					return err
				}
				if err := os.WriteFile(filepath.Join(c.Location, "this/is/a/nested/test/first-file"), []byte("foobar"), 0755); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead:     "master",
					BranchOID:      notEmpty,
					UntrackedFiles: []string{"this/is/a/nested/test/first-file"},
				},
				LatestCommit: notEmpty,
			},
			nil,
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			client, err := newGitClient(ctx)
			if err != nil {
				t.Errorf("cannot prep %s: %v", test.Name, err)
				return
			}

			err = test.Prep(ctx, client)
			if err != nil {
				t.Errorf("cannot prep %s: %v", test.Name, err)
				return
			}

			status, err := client.Status(ctx)
			if err != test.Error {
				t.Errorf("expected error does not match for %s: %v != %v", test.Name, err, test.Error)
				return
			}

			if status != nil {
				if test.Result.BranchOID == notEmpty && status.LatestCommit != "" {
					test.Result.BranchOID = status.LatestCommit
				}
				if test.Result.LatestCommit == notEmpty && status.LatestCommit != "" {
					test.Result.LatestCommit = status.LatestCommit
				}
				for _, c := range test.Result.UnpushedCommits {
					if c == notEmpty {
						if len(status.UnpushedCommits) == 0 {
							t.Errorf("expected unpushed commits")
						}

						test.Result.UnpushedCommits = status.UnpushedCommits
						break
					}
				}
			}

			if diff := cmp.Diff(test.Result, status, cmp.AllowUnexported(Status{})); diff != "" {
				t.Errorf("unexpected status (-want +got):\n%s", diff)
			}
		})
	}
}

func newGitClient(ctx context.Context) (*Client, error) {
	loc, err := os.MkdirTemp("", "gittest")
	if err != nil {
		return nil, err
	}

	return &Client{
		Location: loc,
		Config: map[string]string{
			"user.email": "foo@bar.com",
			"user.name":  "tester",
		},
	}, nil
}

func initFromRemote(ctx context.Context, c *Client) error {
	remote, err := newGitClient(ctx)
	if err != nil {
		return xerrors.Errorf("cannot add remote: %w", err)
	}
	if err := remote.Git(ctx, "init"); err != nil {
		return err
	}
	if err := remote.Git(ctx, "config", "--local", "user.email", "foo@bar.com"); err != nil {
		return err
	}
	if err := remote.Git(ctx, "config", "--local", "user.name", "foo bar"); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(remote.Location, "first-file"), []byte{}, 0755); err != nil {
		return err
	}
	if err := remote.Git(ctx, "add", "first-file"); err != nil {
		return err
	}
	if err := remote.Git(ctx, "commit", "-m", "foo"); err != nil {
		return err
	}

	c.RemoteURI = remote.Location
	if err := c.Clone(ctx); err != nil {
		return err
	}
	if err := c.Git(ctx, "config", "--local", "user.email", "foo@bar.com"); err != nil {
		return err
	}
	if err := c.Git(ctx, "config", "--local", "user.name", "foo bar"); err != nil {
		return err
	}

	return nil
}
