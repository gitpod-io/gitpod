// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"testing"

	"github.com/containerd/containerd/remotes"
	"github.com/google/go-cmp/cmp"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
)

func TestBlobFor(t *testing.T) {
	const (
		refDescriptor = "gitpod.io/test:tag"
		hashManifest  = "5de870aced7e6c182a10e032e94de15893c95edd80d9cc20348b0f1627826d93"
		hashLayer     = "4970405cb2a3a461cc00fd755712beded51919d7e69270d7d10d0dcf5e209714"
	)
	var (
		provideDescriptor = func() ([]byte, error) {
			return json.Marshal(ociv1.Descriptor{
				MediaType: ociv1.MediaTypeImageManifest,
				Digest:    "sha256:" + hashManifest,
				Size:      10,
			})
		}
		descriptorLayer = ociv1.Descriptor{
			MediaType: ociv1.MediaTypeImageLayerGzip,
			Digest:    "sha256:4970405cb2a3a461cc00fd755712beded51919d7e69270d7d10d0dcf5e209714",
			Size:      10,
		}
		provideManifest = func() ([]byte, error) {
			return json.Marshal(ociv1.Manifest{
				Layers: []ociv1.Descriptor{
					descriptorLayer,
				},
			})
		}
		provideLayer = func() ([]byte, error) {
			out := bytes.NewBuffer(nil)
			gz := gzip.NewWriter(out)
			tr := tar.NewWriter(gz)
			tr.WriteHeader(&tar.Header{Typeflag: tar.TypeReg, Name: "foo.txt", Size: 0})
			tr.Close()
			gz.Close()
			return out.Bytes(), nil
		}
	)
	type Expectation struct {
		Error    string
		Refcache map[string]string
		Content  map[string]blobstate
	}

	tests := []struct {
		Desc             string
		FetchableContent map[string]provider
		ExtraAction      func(t *testing.T, s *refstore) error
		Expectation      Expectation
	}{
		{
			Desc: "cached fetch",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
				hashLayer:     provideLayer,
			},
			ExtraAction: func(t *testing.T, s *refstore) (err error) {
				_, _, err = s.BlobFor(context.Background(), refDescriptor, false)
				if err != nil {
					return err
				}

				// fetching again with an empty fake fetcher should work just fine - everything is cached now
				s.Resolver = func() remotes.Resolver { return &fakeFetcher{} }
				_, hash, err := s.BlobFor(context.Background(), refDescriptor, false)

				if diff := cmp.Diff(hashLayer, hash); diff != "" {
					t.Errorf("unexpected blob hash (-want +got):\n%s", diff)
				}

				return err
			},
			Expectation: Expectation{
				Content: map[string]blobstate{hashLayer: blobReady},
				Refcache: map[string]string{
					refDescriptor: hashLayer,
				},
			},
		},
		{
			Desc:             "ref not found",
			FetchableContent: map[string]provider{},
			Expectation: Expectation{
				Error: "not found",
			},
		},
		{
			Desc: "manifest not found",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
			},
			Expectation: Expectation{
				Error: "cannot download manifest: " + hashManifest + " not found",
			},
		},
		{
			Desc: "layer not found",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
			},
			Expectation: Expectation{
				Error: hashLayer + " not found",
			},
		},
		{
			Desc: "no layers",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest: func() ([]byte, error) {
					return json.Marshal(ociv1.Manifest{})
				},
			},
			Expectation: Expectation{
				Error: "not found",
			},
		},
		{
			Desc: "two layers",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest: func() ([]byte, error) {
					return json.Marshal(ociv1.Manifest{
						Layers: []ociv1.Descriptor{
							descriptorLayer,
							{
								MediaType: ociv1.MediaTypeImageLayerGzip,
								Digest:    "sha256:ff20094863725f7f1a6b06b281d009143c1510f1985ff87bc0229816ac3e853c",
								Size:      10,
							},
						},
					})
				},
				hashLayer: provideLayer,
			},
			Expectation: Expectation{
				Content: map[string]blobstate{hashLayer: blobReady},
				Refcache: map[string]string{
					refDescriptor: hashLayer,
				},
			},
		},
		{
			Desc: "layer on second attempt",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
			},
			ExtraAction: func(t *testing.T, s *refstore) (err error) {
				_, _, err = s.BlobFor(context.Background(), refDescriptor, false)
				if err == nil {
					return xerrors.Errorf("found layer although we shouldn't have")
				}
				s.Resolver = func() remotes.Resolver {
					return &fakeFetcher{
						Content: map[string]provider{
							refDescriptor: provideDescriptor,
							hashManifest:  provideManifest,
							hashLayer:     provideLayer,
						},
					}
				}
				_, _, err = s.BlobFor(context.Background(), refDescriptor, false)
				if err != nil {
					return err
				}
				return nil
			},
			Expectation: Expectation{
				Refcache: map[string]string{
					refDescriptor: hashLayer,
				},
				Content: map[string]blobstate{
					hashLayer: blobReady,
				},
			},
		},
		{
			Desc: "1000 parallel downloads",
			ExtraAction: func(t *testing.T, s *refstore) error {
				var (
					mu   sync.Mutex
					once bool
					run  = make(chan struct{})
				)
				s.Resolver = func() remotes.Resolver {
					mu.Lock()
					defer mu.Unlock()

					if once {
						return &fakeFetcher{}
					}
					once = true

					return &fakeFetcher{
						Content: map[string]provider{
							refDescriptor: provideDescriptor,
							hashManifest:  provideManifest,
							hashLayer:     provideLayer,
						},
					}
				}

				eg, ctx := errgroup.WithContext(context.Background())
				for i := 0; i < 1000; i++ {
					i := i
					eg.Go(func() error {
						if i == 100 {
							close(run)
						}
						_, _, err := s.BlobFor(ctx, refDescriptor, false)
						if err != nil {
							return xerrors.Errorf("client %03d: %w", i, err)
						}
						return nil
					})
				}
				err := eg.Wait()
				return err
			},
			Expectation: Expectation{
				Refcache: map[string]string{refDescriptor: "4970405cb2a3a461cc00fd755712beded51919d7e69270d7d10d0dcf5e209714"},
				Content:  map[string]blobstate{"4970405cb2a3a461cc00fd755712beded51919d7e69270d7d10d0dcf5e209714": blobReady},
			},
		},
		{
			Desc: "readonly pre-existing",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
				hashLayer:     provideLayer,
			},
			ExtraAction: func(t *testing.T, s *refstore) error {
				_, _, err := s.BlobFor(context.Background(), refDescriptor, false)
				if err != nil {
					return err
				}
				_, _, err = s.BlobFor(context.Background(), refDescriptor, true)
				if err != nil {
					return err
				}
				return nil
			},
			Expectation: Expectation{
				Refcache: map[string]string{refDescriptor: "4970405cb2a3a461cc00fd755712beded51919d7e69270d7d10d0dcf5e209714"},
				Content:  map[string]blobstate{"4970405cb2a3a461cc00fd755712beded51919d7e69270d7d10d0dcf5e209714": blobReady},
			},
		},
		{
			Desc: "readonly non-existent",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
				hashLayer:     provideLayer,
			},
			ExtraAction: func(t *testing.T, s *refstore) error {
				_, _, err := s.BlobFor(context.Background(), refDescriptor, true)
				if err != nil {
					return err
				}
				return nil
			},
			Expectation: Expectation{
				Error: "not found",
			},
		},
		{
			Desc: "blobspace looses blobs",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
				hashLayer:     provideLayer,
			},
			ExtraAction: func(t *testing.T, s *refstore) error {
				_, _, err := s.BlobFor(context.Background(), refDescriptor, false)
				if err != nil {
					return err
				}

				delete(s.blobspace.(*inMemoryBlobspace).Content, hashLayer)

				_, _, err = s.BlobFor(context.Background(), refDescriptor, false)
				if err != nil {
					return err
				}
				return nil
			},
			Expectation: Expectation{
				Content: map[string]blobstate{hashLayer: blobReady},
				Refcache: map[string]string{
					refDescriptor: hashLayer,
				},
			},
		},
		{
			Desc: "blobspace looses blobs (readonly)",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
				hashLayer:     provideLayer,
			},
			ExtraAction: func(t *testing.T, s *refstore) error {
				_, _, err := s.BlobFor(context.Background(), refDescriptor, false)
				if err != nil {
					return err
				}

				delete(s.blobspace.(*inMemoryBlobspace).Content, hashLayer)

				_, _, err = s.BlobFor(context.Background(), refDescriptor, true)
				if err != nil {
					return err
				}
				return nil
			},
			Expectation: Expectation{
				Content: map[string]blobstate{hashLayer: blobReady},
				Refcache: map[string]string{
					refDescriptor: hashLayer,
				},
			},
		},
		{
			Desc: "first layer download fails",
			FetchableContent: map[string]provider{
				refDescriptor: provideDescriptor,
				hashManifest:  provideManifest,
				hashLayer:     provideLayer,
			},
			ExtraAction: func(t *testing.T, s *refstore) error {
				bs := s.blobspace.(*inMemoryBlobspace)
				oadd := bs.Adder

				bs.Adder = func(ctx context.Context, name string, in io.Reader) (err error) {
					return xerrors.Errorf("failed to download")
				}
				_, _, err := s.BlobFor(context.Background(), refDescriptor, false)
				if err == nil {
					return xerrors.Errorf("first download didn't fail")
				}

				bs.Adder = oadd
				_, _, err = s.BlobFor(context.Background(), refDescriptor, false)
				if err != nil {
					return err
				}
				return nil
			},
			Expectation: Expectation{
				Content: map[string]blobstate{hashLayer: blobReady},
				Refcache: map[string]string{
					refDescriptor: hashLayer,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			ff := &fakeFetcher{Content: test.FetchableContent}

			content := make(map[string]blobstate)
			bs := &inMemoryBlobspace{
				Content: content,
				Adder: func(ctx context.Context, name string, in io.Reader) (err error) {
					content[name] = blobReady
					return nil
				},
			}

			var res Expectation

			s := &refstore{
				Resolver:  func() remotes.Resolver { return ff },
				blobspace: bs,
				refcache:  make(map[string]*refstate),
				close:     make(chan struct{}),
				once:      &sync.Once{},
				requests:  make(chan downloadRequest),
			}
			for i := 0; i < parallelBlobDownloads; i++ {
				go s.serveRequests()
			}
			defer s.Close()

			var err error
			if test.ExtraAction == nil {
				_, _, err = s.BlobFor(context.Background(), refDescriptor, false)
			} else {
				err = test.ExtraAction(t, s)
			}
			if err != nil {
				res.Error = err.Error()
			}

			if len(content) > 0 {
				res.Content = content
			}
			if len(s.refcache) > 0 {
				res.Refcache = make(map[string]string)
				for k, v := range s.refcache {
					res.Refcache[k] = v.Digest
				}
			}

			if diff := cmp.Diff(test.Expectation, res); diff != "" {
				t.Errorf("unexpected state (-want +got):\n%s", diff)
			}
		})
	}

}

type inMemoryBlobspace struct {
	Content map[string]blobstate
	Adder   func(ctx context.Context, name string, in io.Reader) (err error)
}

func (s *inMemoryBlobspace) Get(name string) (fs http.FileSystem, state blobstate) {
	return &FakeFileSystem{}, s.Content[name]
}

func (s *inMemoryBlobspace) AddFromTarGzip(ctx context.Context, name string, in io.Reader, modifications map[string]FileModifier) (err error) {
	return s.Adder(ctx, name, in)
}

type provider func() ([]byte, error)

type fakeFetcher struct {
	Content map[string]provider
}

func (f *fakeFetcher) Resolve(ctx context.Context, ref string) (name string, desc ociv1.Descriptor, err error) {
	name = ref
	fc, ok := f.Content[ref]
	if !ok {
		err = xerrors.Errorf("not found")
		return
	}
	c, err := fc()
	if err != nil {
		return
	}

	err = json.Unmarshal(c, &desc)
	return
}

// Pusher returns a new pusher for the provided reference
func (f *fakeFetcher) Pusher(ctx context.Context, ref string) (remotes.Pusher, error) {
	return nil, xerrors.Errorf("not implemented")
}

// Fetcher returns a new fetcher for the provided reference.
// All content fetched from the returned fetcher will be
// from the namespace referred to by ref.
func (f *fakeFetcher) Fetcher(ctx context.Context, ref string) (remotes.Fetcher, error) {
	return f, nil
}

func (f *fakeFetcher) Fetch(ctx context.Context, desc ociv1.Descriptor) (io.ReadCloser, error) {
	fc, ok := f.Content[desc.Digest.Encoded()]
	if !ok {
		return nil, xerrors.Errorf("%s not found", desc.Digest.Encoded())
	}
	c, err := fc()
	if err != nil {
		return nil, err
	}

	return io.NopCloser(bytes.NewReader(c)), nil
}

type FakeFileSystem struct {
}

func (FakeFileSystem) Open(name string) (http.File, error) {
	return nil, nil
}
