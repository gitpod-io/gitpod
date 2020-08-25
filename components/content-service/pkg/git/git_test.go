// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package git

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"golang.org/x/xerrors"
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
					BranchOID:  "not-empty",
				},
				LatestCommit: "not-empty",
			},
			nil,
		},
		{
			"untracked files",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := ioutil.WriteFile(filepath.Join(c.Location, "another-file"), []byte{}, 0755); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead:     "master",
					BranchOID:      "not-empty",
					UntrackedFiles: []string{"another-file"},
				},
				LatestCommit: "not-empty",
			},
			nil,
		},
		{
			"uncommited files",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := ioutil.WriteFile(filepath.Join(c.Location, "first-file"), []byte("foobar"), 0755); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead:      "master",
					BranchOID:       "not-empty",
					UncommitedFiles: []string{"first-file"},
				},
				LatestCommit: "not-empty",
			},
			nil,
		},
		{
			"unpushed commits",
			func(ctx context.Context, c *Client) error {
				if err := initFromRemote(ctx, c); err != nil {
					return err
				}
				if err := ioutil.WriteFile(filepath.Join(c.Location, "first-file"), []byte("foobar"), 0755); err != nil {
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
					BranchOID:  "not-empty",
				},
				UnpushedCommits: []string{"not-empty"},
				LatestCommit:    "not-empty",
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
				if err := ioutil.WriteFile(filepath.Join(c.Location, "first-file"), []byte("foobar"), 0755); err != nil {
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
					BranchOID:  "not-empty",
				},
				UnpushedCommits: []string{"not-empty"},
				LatestCommit:    "not-empty",
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
				if err := ioutil.WriteFile(filepath.Join(c.Location, "this/is/a/nested/test/first-file"), []byte("foobar"), 0755); err != nil {
					return err
				}
				return nil
			},
			&Status{
				porcelainStatus: porcelainStatus{
					BranchHead:     "master",
					BranchOID:      "not-empty",
					UntrackedFiles: []string{"this/is/a/nested/test/first-file"},
				},
				LatestCommit: "not-empty",
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
				if test.Result.BranchOID == "not-empty" && status.LatestCommit != "" {
					test.Result.BranchOID = status.LatestCommit
				}
				if test.Result.LatestCommit == "not-empty" && status.LatestCommit != "" {
					test.Result.LatestCommit = status.LatestCommit
				}
				for _, c := range test.Result.UnpushedCommits {
					if c == "not-empty" {
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
	loc, err := ioutil.TempDir("", "gittest")
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
	if err := ioutil.WriteFile(filepath.Join(remote.Location, "first-file"), []byte{}, 0755); err != nil {
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
