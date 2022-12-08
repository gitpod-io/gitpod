// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

//go:generate sh -c "mockgen -package resolve_test github.com/containerd/containerd/remotes Resolver,Fetcher > resolve_mock_test.go"
//go:generate leeway run components:update-license-header

package resolve_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"testing"

	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
)

func TestStandaloneRefResolverResolve(t *testing.T) {
	type Expectation struct {
		Ref   string
		Error string
	}
	type ResolveResponse struct {
		Error         error
		ResolvedRef   string
		NormalisedRef string
		MF            *ociv1.Manifest
		Index         *ociv1.Index
	}
	tests := []struct {
		Name            string
		ResolveResponse ResolveResponse
		Expectation     Expectation
		Ref             string
	}{
		{
			Name: "basic resolve",
			Ref:  "docker.io/library/alpine:latest",
			ResolveResponse: ResolveResponse{
				MF: &ociv1.Manifest{Config: ociv1.Descriptor{Size: 1}},
			},
			Expectation: Expectation{
				Ref: "docker.io/library/alpine@sha256:25d33b2d291ce47c3e4059589766ed98fadab639577efe5e9c89e4a4b50888fc",
			},
		},
		{
			Name: "with-port",
			Ref:  "some-internal-registry.customer.com:5000/gitpod/base-image:latest",
			ResolveResponse: ResolveResponse{
				MF: &ociv1.Manifest{Config: ociv1.Descriptor{Size: 1}},
			},
			Expectation: Expectation{
				Ref: "some-internal-registry.customer.com:5000/gitpod/base-image@sha256:25d33b2d291ce47c3e4059589766ed98fadab639577efe5e9c89e4a4b50888fc",
			},
		},
		{
			Name: "with-broken-index",
			Ref:  "docker.io/library/alpine:latest",
			ResolveResponse: ResolveResponse{
				Index: &ociv1.Index{
					Manifests: []ociv1.Descriptor{
						{
							MediaType: ociv1.MediaTypeImageManifest,
							Digest:    digest.FromString(""),
						},
					},
				},
			},
			Expectation: Expectation{Error: "no manifest for platform linux-amd64 found"},
		},
		{
			Name: "with-working-index",
			Ref:  "docker.io/library/alpine:latest",
			ResolveResponse: ResolveResponse{
				Index: &ociv1.Index{
					Manifests: []ociv1.Descriptor{
						{
							MediaType: ociv1.MediaTypeImageManifest,
							Digest:    digest.FromString(""),
							Platform: &ociv1.Platform{
								Architecture: "amd64",
								OS:           "linux",
							},
						},
					},
				},
			},
			Expectation: Expectation{Ref: "docker.io/library/alpine@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
		},
		{
			Name: "not authorized",
			Ref:  "registry-1.testing.gitpod-self-hosted.com:5000/gitpod/gitpod/workspace-full:latest",
			ResolveResponse: ResolveResponse{
				Error: errors.New("401 Unauthorized"),
			},
			Expectation: Expectation{
				Error: resolve.ErrUnauthorized.Error(),
			},
		},
		{
			Name: "not found",
			Ref:  "something.com/we/dont:find",
			ResolveResponse: ResolveResponse{
				Error: errdefs.ErrNotFound,
			},
			Expectation: Expectation{
				Error: resolve.ErrNotFound.Error(),
			},
		},
		{
			Name: "familiar name",
			Ref:  "alpine:latest",
			ResolveResponse: ResolveResponse{
				NormalisedRef: "docker.io/library/alpine:latest",
				Error:         errdefs.ErrNotFound,
			},
			Expectation: Expectation{
				Error: resolve.ErrNotFound.Error(),
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			factory := func() remotes.Resolver {
				resolver := NewMockResolver(ctrl)

				resolvedRef := test.ResolveResponse.ResolvedRef
				if resolvedRef == "" {
					resolvedRef = test.Ref
				}
				normalizedRef := test.ResolveResponse.NormalisedRef
				if normalizedRef == "" {
					normalizedRef = test.Ref
				}
				var respBytes []byte
				switch {
				case test.ResolveResponse.MF != nil:
					var err error
					respBytes, err = json.Marshal(test.ResolveResponse.MF)
					if err != nil {
						t.Fatal(err)
					}

				case test.ResolveResponse.Index != nil:
					var err error
					respBytes, err = json.Marshal(test.ResolveResponse.Index)
					if err != nil {
						t.Fatal(err)
					}
				default:
				}
				if respBytes == nil {
					resolver.EXPECT().Resolve(gomock.Any(), gomock.Eq(normalizedRef)).AnyTimes().Return("", ociv1.Descriptor{}, test.ResolveResponse.Error)
				} else {
					resolver.EXPECT().Resolve(gomock.Any(), gomock.Eq(normalizedRef)).AnyTimes().Return(resolvedRef, ociv1.Descriptor{
						MediaType: ociv1.MediaTypeImageManifest,
						Digest:    digest.FromBytes(respBytes),
						Size:      int64(len(respBytes)),
					}, nil)
					fetcher := NewMockFetcher(ctrl)
					fetcher.EXPECT().Fetch(gomock.Any(), gomock.Any()).AnyTimes().Return(io.NopCloser(bytes.NewReader(respBytes)), nil).AnyTimes()
					resolver.EXPECT().Fetcher(gomock.Any(), gomock.Any()).AnyTimes().Return(fetcher, nil)
				}

				return resolver
			}

			sr := &resolve.StandaloneRefResolver{ResolverFactory: factory}
			ref, err := sr.Resolve(context.Background(), test.Ref)
			act := Expectation{Ref: ref}
			if err != nil {
				act.Error = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Resolve() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
