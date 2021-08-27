// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resolve_test

import (
	"context"
	"testing"

	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	"github.com/google/go-cmp/cmp"
	"github.com/opencontainers/go-digest"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
)

func TestStandaloneResolver(t *testing.T) {
	defaultRefs := map[string]fakeResolverEntry{
		"docker.io/gitpod-io/workspace-full:latest": {
			Name: "docker.io/gitpod-io/workspace-full:latest",
			Desc: ocispec.Descriptor{
				Digest: digest.FromBytes([]byte("hello world")),
			},
		},
	}
	type Expectation struct {
		Res string
		Err string
	}
	tests := []struct {
		Name        string
		Refs        map[string]fakeResolverEntry
		Ref         string
		Expectation Expectation
	}{
		{
			Name:        "no host",
			Refs:        defaultRefs,
			Ref:         "gitpod-io/workspace-full:latest",
			Expectation: Expectation{Res: "docker.io/gitpod-io/workspace-full:latest"},
		},
		{
			Name:        "no tag",
			Refs:        defaultRefs,
			Ref:         "docker.io/gitpod-io/workspace-full",
			Expectation: Expectation{Res: "docker.io/gitpod-io/workspace-full:latest"},
		},
		{
			Name:        "with digest",
			Refs:        defaultRefs,
			Ref:         "docker.io/gitpod-io/workspace-full:latest@sha256:c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
			Expectation: Expectation{Res: "docker.io/gitpod-io/workspace-full:latest@sha256:c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"},
		},
		{
			Name:        "not found",
			Refs:        defaultRefs,
			Ref:         "this/does/not/exist",
			Expectation: Expectation{Err: "not found"},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			sr := resolve.StandaloneRefResolver{
				func() remotes.Resolver {
					return &fakeResolver{Refs: test.Refs}
				},
			}
			res, err := sr.Resolve(context.Background(), test.Ref)
			act := Expectation{Res: res}
			if err != nil {
				act.Err = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("StandaloneRefResolver.Resolve() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

type fakeResolverEntry struct {
	Name string
	Desc ocispec.Descriptor
}

type fakeResolver struct {
	Refs map[string]fakeResolverEntry
}

func (f *fakeResolver) Resolve(ctx context.Context, ref string) (name string, desc ocispec.Descriptor, err error) {
	c, found := f.Refs[ref]
	if !found {
		return "", desc, errdefs.ErrNotFound
	}

	return c.Name, c.Desc, nil
}
func (*fakeResolver) Fetcher(ctx context.Context, ref string) (remotes.Fetcher, error) {
	return nil, xerrors.Errorf("not supporter")
}
func (*fakeResolver) Pusher(ctx context.Context, ref string) (remotes.Pusher, error) {
	return nil, xerrors.Errorf("not supporter")
}
