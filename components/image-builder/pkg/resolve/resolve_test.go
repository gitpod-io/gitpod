// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resolve_test

//go:generate sh -c "go get github.com/golang/mock/mockgen && mockgen -destination dockerclient_mock_test.go -package resolve_test github.com/docker/docker/client DistributionAPIClient"

import (
	"context"
	"fmt"
	"testing"

	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"

	registry "github.com/docker/docker/api/types/registry"
	"github.com/golang/mock/gomock"
	digest "github.com/opencontainers/go-digest"
	"github.com/opencontainers/image-spec/specs-go/v1"
)

func TestDockerRegistryResolver(t *testing.T) {
	tests := []struct {
		Ref    string
		Parsed string
		Err    error
	}{
		{"alpine:latest", "docker.io/library/alpine:latest", nil},
		{"alpine:3.14", "docker.io/library/alpine:3.14", nil},
		{"gitpod/workspace-full:build-branch-master", "docker.io/gitpod/workspace-full:build-branch-master", nil},
		{"gitpod/does-not-exist", "docker.io/gitpod/does-not-exist", xerrors.Errorf("does not exist")},
	}

	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	for _, tst := range tests {
		dic := NewMockDistributionAPIClient(ctrl)
		tgtcall := dic.EXPECT().DistributionInspect(gomock.Any(), gomock.Eq(tst.Parsed), gomock.Any())

		var dgst digest.Digest
		if tst.Err != nil {
			tgtcall.Return(registry.DistributionInspect{}, tst.Err)
		} else {
			dgst = digest.Canonical.FromString("this-is-the-digest")
			tgtcall.Return(registry.DistributionInspect{
				Descriptor: v1.Descriptor{
					Digest: dgst,
				},
			}, nil)
		}
		tgtcall.Times(1)

		resolver := &resolve.DockerRegistryResolver{dic}
		res, err := resolver.Resolve(context.Background(), tst.Ref)
		if err != nil {
			if err != tst.Err {
				t.Errorf("unexpected error: %v", err)
			}
		} else {
			exp := fmt.Sprintf("%s@%s", tst.Parsed, dgst)
			if res != exp {
				t.Errorf("result does not match expectation: result=%s expectation=%s", res, exp)
			}
		}
	}
}
