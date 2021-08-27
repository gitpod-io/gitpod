// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"io"
	"os"
	"testing"
	"time"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"golang.org/x/xerrors"

	"github.com/containerd/containerd/remotes"
	"github.com/containerd/containerd/remotes/docker"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

type testStaticLayerSourceFixture struct {
	SourceRef string            `json:"sourceRef"`
	Content   map[string][]byte `json:"content"`
	Envs      []string          `json:"envs"`
}

var fetchFixture = flag.String("fetch-fixture", "", "create a new fixture from an image ref")

func TestStaticLayerSource(t *testing.T) {
	if *fetchFixture != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		fix, err := createFixtureFromImage(ctx, docker.NewResolver(docker.ResolverOptions{}), *fetchFixture)
		if err != nil {
			t.Fatalf("cannot download ref: %+q", err)
		}

		out, err := json.MarshalIndent(fix, "", "    ")
		if err != nil {
			t.Fatalf("cannot marshal fixture: %+q", err)
		}

		err = os.WriteFile("fixtures/layersrc_new.json", out, 0600)
		if err != nil {
			t.Fatalf("cannot write fixture: %+q", err)
		}

		t.Log("wrote fixture to fixtures/layersrc_new.json")
		return
	}

	type gold struct {
		Error string       `json:"error"`
		Layer []AddonLayer `json:"layer"`
		Envs  []string     `json:"envs"`
	}
	test := ctesting.FixtureTest{
		T:    t,
		Path: "fixtures/layersrc_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*testStaticLayerSourceFixture)

			src, err := NewStaticSourceFromImage(context.Background(), &fakeFetcher{Content: fixture.Content}, fixture.SourceRef)
			if err != nil {
				return &gold{Error: err.Error()}
			}

			res := make([]AddonLayer, len(src.layers))
			for i := range src.layers {
				res[i] = src.layers[i].AddonLayer
			}
			envs := parseEnvs(fixture.Envs)
			for _, e := range src.envs {
				e(envs)
			}
			return &gold{Layer: res, Envs: envs.serialize()}
		},
		Fixture: func() interface{} { return &testStaticLayerSourceFixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}

func createFixtureFromImage(ctx context.Context, resolver remotes.Resolver, ref string) (*testStaticLayerSourceFixture, error) {
	fetcher, err := resolver.Fetcher(ctx, ref)
	if err != nil {
		return nil, err
	}

	content := make(map[string][]byte)
	_, desc, err := resolver.Resolve(ctx, ref)
	if err != nil {
		return nil, err
	}
	content[ref], err = json.Marshal(desc)
	if err != nil {
		return nil, err
	}

	mf, _, err := DownloadManifest(ctx, fetcher, desc)
	if err != nil {
		return nil, err
	}
	content[desc.Digest.Encoded()], err = json.Marshal(mf)
	if err != nil {
		return nil, err
	}

	cfg, err := DownloadConfig(ctx, fetcher, mf.Config)
	if err != nil {
		return nil, err
	}
	content[mf.Config.Digest.Encoded()], err = json.Marshal(cfg)
	if err != nil {
		return nil, err
	}

	return &testStaticLayerSourceFixture{
		SourceRef: ref,
		Content:   content,
	}, nil
}

type fakeFetcher struct {
	Content map[string][]byte
}

func (f *fakeFetcher) Resolve(ctx context.Context, ref string) (name string, desc ocispec.Descriptor, err error) {
	name = ref
	c, ok := f.Content[ref]
	if !ok {
		err = xerrors.Errorf("not found")
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

func (f *fakeFetcher) Fetch(ctx context.Context, desc ocispec.Descriptor) (io.ReadCloser, error) {
	c, ok := f.Content[desc.Digest.Encoded()]
	if !ok {
		return nil, xerrors.Errorf("not found")
	}
	return io.NopCloser(bytes.NewReader(c)), nil
}
