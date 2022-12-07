// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/containerd/containerd/content"
	"github.com/containerd/containerd/errdefs"
	"github.com/opencontainers/go-digest"
	"github.com/opencontainers/image-spec/specs-go"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
)

func TestDownloadManifest(t *testing.T) {
	tests := []struct {
		Name    string
		Store   BlobStore
		FetchMF bool
	}{
		{
			Name: "no store",
		},
		{
			Name:  "accepts nothing store",
			Store: &alwaysNotFoundStore{},
		},
		{
			Name:  "misbehaving store",
			Store: &misbehavingStore{},
		},
		{
			Name:    "fetch mf no store",
			FetchMF: true,
		},
		{
			Name:    "fetch mf with store",
			Store:   &alwaysNotFoundStore{},
			FetchMF: true,
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			cfg, err := json.Marshal(ociv1.ImageConfig{})
			if err != nil {
				t.Fatal(err)
			}
			cfgDgst := digest.FromBytes(cfg)

			mf, err := json.Marshal(ociv1.Manifest{
				Versioned: specs.Versioned{SchemaVersion: 1},
				MediaType: ociv1.MediaTypeImageManifest,
				Config: ociv1.Descriptor{
					MediaType: ociv1.MediaTypeImageConfig,
					Digest:    cfgDgst,
					Size:      int64(len(cfg)),
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			mfDgst := digest.FromBytes(mf)
			mfDesc := ociv1.Descriptor{
				MediaType: ociv1.MediaTypeImageManifest,
				Digest:    mfDgst,
				Size:      int64(len(mf)),
			}

			mfl, err := json.Marshal(ociv1.Index{
				MediaType: ociv1.MediaTypeImageIndex,
				Manifests: []ociv1.Descriptor{mfDesc},
			})
			if err != nil {
				t.Fatal(err)
			}
			mflDgst := digest.FromBytes(mfl)
			mflDesc := ociv1.Descriptor{
				MediaType: ociv1.MediaTypeImageIndex,
				Digest:    mflDgst,
				Size:      int64(len(mfl)),
			}

			fetcher := AsFetcherFunc(&fakeFetcher{
				Content: map[string][]byte{
					mflDgst.Encoded(): mfl,
					mfDgst.Encoded():  mf,
					cfgDgst.Encoded(): cfg,
				},
			})
			desc := mflDesc
			if test.FetchMF {
				desc = mfDesc
			}
			_, _, err = DownloadManifest(context.Background(), fetcher, desc, WithStore(test.Store))
			if err != nil {
				t.Fatal(err)
			}
		})
	}
}

type alwaysNotFoundStore struct{}

func (fbs *alwaysNotFoundStore) ReaderAt(ctx context.Context, desc ociv1.Descriptor) (content.ReaderAt, error) {
	return nil, errdefs.ErrNotFound
}

// Some implementations require WithRef to be included in opts.
func (fbs *alwaysNotFoundStore) Writer(ctx context.Context, opts ...content.WriterOpt) (content.Writer, error) {
	return nil, errdefs.ErrAlreadyExists
}

// Info will return metadata about content available in the content store.
//
// If the content is not present, ErrNotFound will be returned.
func (fbs *alwaysNotFoundStore) Info(ctx context.Context, dgst digest.Digest) (content.Info, error) {
	return content.Info{}, errdefs.ErrNotFound
}

type misbehavingStore struct{}

func (fbs *misbehavingStore) ReaderAt(ctx context.Context, desc ociv1.Descriptor) (content.ReaderAt, error) {
	return nil, fmt.Errorf("foobar")
}

// Some implementations require WithRef to be included in opts.
func (fbs *misbehavingStore) Writer(ctx context.Context, opts ...content.WriterOpt) (content.Writer, error) {
	return nil, fmt.Errorf("some error")
}

// Info will return metadata about content available in the content store.
//
// If the content is not present, ErrNotFound will be returned.
func (fbs *misbehavingStore) Info(ctx context.Context, dgst digest.Digest) (content.Info, error) {
	return content.Info{}, fmt.Errorf("you wish")
}
