// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	"github.com/docker/distribution/reference"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/registry-facade/pkg/registry"
)

const (
	// parallelBlobDownloads is the number of service worker a refstore uses to
	// serve download requests.
	parallelBlobDownloads = 10
)

// blobModifier modifies files in a blob. The path is relative to the blob's
// workdir.
type blobModifier struct {
	Path     string
	Modifier FileModifier
}

// BlobConfig configures the behaviour of blobs served from a refstore
type blobConfig struct {
	// Workdir is the path that files are served from relative to the blob root.
	Workdir  string
	Modifier []blobModifier
}

type refstore struct {
	Resolver ResolverProvider

	mu        sync.RWMutex
	refcache  map[string]*refstate
	requests  chan downloadRequest
	blobspace blobspace
	config    map[string]blobConfig

	close chan struct{}
	once  *sync.Once
}

func newRefStore(cfg Config, resolver ResolverProvider) (*refstore, error) {
	bs, err := newBlobSpace(cfg.BlobSpace.Location, cfg.BlobSpace.MaxSize, 10*time.Minute)
	if err != nil {
		return nil, err
	}

	config := make(map[string]blobConfig)
	for ref, repo := range cfg.Repos {
		mods := make([]blobModifier, 0, len(repo.Replacements))
		for _, mod := range repo.Replacements {
			mods = append(mods, blobModifier{Path: mod.Path, Modifier: modifySearchAndReplace(mod.Search, mod.Replacement)})
		}

		config[ref] = blobConfig{
			Workdir:  repo.Workdir,
			Modifier: mods,
		}
	}

	res := &refstore{
		Resolver:  resolver,
		blobspace: bs,
		config:    config,
		refcache:  make(map[string]*refstate),
		requests:  make(chan downloadRequest),
		once:      &sync.Once{},
		close:     make(chan struct{}),
	}
	for i := 0; i < parallelBlobDownloads; i++ {
		go res.serveRequests()
	}
	return res, nil
}

type refstate struct {
	Digest string

	ch chan error
}

func (r *refstate) Done() bool {
	select {
	case <-r.ch:
		return true
	default:
		return false
	}
}

func (r *refstate) Wait(ctx context.Context) (err error) {
	select {
	case err := <-r.ch:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (r *refstate) MarkDone(err error) {
	select {
	case r.ch <- err:
		// error sent
	default:
		// no receiver
	}
	close(r.ch)
}

type BlobForOpts struct {
	ReadOnly bool
	Modifier map[string]FileModifier
}

func (store *refstore) BlobFor(ctx context.Context, ref string, readOnly bool) (fs http.FileSystem, hash string, err error) {
	store.mu.RLock()
	rs, exists := store.refcache[ref]
	store.mu.RUnlock()

	if exists {
		err = rs.Wait(ctx)
		if err != nil {
			return nil, "", err
		}
	}
	if !exists && readOnly {
		return nil, "", errdefs.ErrNotFound
	}

	blobState := blobUnknown
	if exists {
		// refcache thinks this blob should exist. It might have been GC'ed in the meantime,
		// hence blobState can validly be blobUnknown.
		fs, blobState = store.blobspace.Get(rs.Digest)
	}
	if blobState == blobUnknown {
		// if refcache thinks the blob should exist, but it doesn't, we force a redownload.
		err = store.downloadBlobFor(ctx, ref, exists)
		if err != nil {
			return nil, "", err
		}
		store.mu.RLock()
		rs = store.refcache[ref]
		store.mu.RUnlock()

		// Even though we triggered a download, that doesn't mean
		// it was our download request that actually is at work here.
		// We have to wait for the download to actually finish.
		err = rs.Wait(ctx)
		if err != nil {
			return nil, "", err
		}

		// now that we've (re-)attempted to download the blob, it must exist.
		// if it doesn't something went wrong while trying to download this thing.
		fs, blobState = store.blobspace.Get(rs.Digest)
	}

	if fs == nil {
		log.
			WithField("digest", rs.Digest).
			WithField("blobState", blobState).
			Error("Blob could not be found for an unknown reason.")
		return nil, "", errdefs.ErrUnknown
	}

	return fs, rs.Digest, nil
}

func (store *refstore) Close() {
	store.once.Do(func() {
		close(store.requests)
		close(store.close)
	})
}

type downloadRequest struct {
	Context context.Context
	Ref     string
	Force   bool
	Resp    chan<- error
}

func (store *refstore) downloadBlobFor(ctx context.Context, ref string, force bool) (err error) {
	resp := make(chan error, 1)
	store.requests <- downloadRequest{
		Context: ctx,
		Ref:     ref,
		Resp:    resp,
		Force:   force,
	}

	select {
	case r := <-resp:
		return r
	case <-store.close:
		return xerrors.Errorf("store closed")
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (store *refstore) serveRequests() {
	for req := range store.requests {
		req.Resp <- store.handleRequest(req.Context, req.Ref, req.Force)
	}
}

func (store *refstore) handleRequest(ctx context.Context, ref string, force bool) (err error) {
	store.mu.Lock()
	rs, exists := store.refcache[ref]
	if exists && !force {
		// someone has handled this request already
		store.mu.Unlock()
		return nil
	}
	rs = &refstate{ch: make(chan error)}
	store.refcache[ref] = rs
	store.mu.Unlock()

	defer func() {
		if err != nil {
			store.mu.Lock()
			delete(store.refcache, ref)
			store.mu.Unlock()
		}
		rs.MarkDone(err)
	}()

	resolver := store.Resolver()

	layer, err := resolveRef(ctx, ref, resolver)
	if err != nil {
		return err
	}
	digest := layer.Digest.Hex()
	rs.Digest = digest

	fetcher, err := resolver.Fetcher(ctx, ref)
	if err != nil {
		return err
	}

	for {
		_, state := store.blobspace.Get(digest)
		switch state {
		case blobUnknown:
			in, err := fetcher.Fetch(ctx, *layer)
			if err != nil {
				return err
			}

			pref, err := reference.ParseNamed(ref)
			if err != nil {
				return err
			}

			var mods []blobModifier
			cfg, ok := store.config[reference.Domain(pref)+"/"+reference.Path(pref)]
			if ok {
				mods = cfg.Modifier
			}

			err = store.blobspace.AddFromTarGzip(ctx, digest, in, mods)
			in.Close()
			if err != nil {
				return xerrors.Errorf("cannot download blob: %w", err)
			}

		case blobUnready:
			if ctx.Err() != nil {
				return err
			}

			// TODO(cw): replace busy waiting on the blob becoming available with something mutex/channel based
			time.Sleep(500 * time.Millisecond)

		case blobReady:
			return nil
		}
	}
}

func resolveRef(ctx context.Context, ref string, resolver remotes.Resolver) (*ociv1.Descriptor, error) {
	_, desc, err := resolver.Resolve(ctx, ref)
	if err != nil {
		return nil, err
	}
	fetcher, err := resolver.Fetcher(ctx, ref)
	if err != nil {
		return nil, err
	}
	manifest, _, err := registry.DownloadManifest(ctx, fetcher, desc)
	if err != nil {
		return nil, err
	}

	layerCount := len(manifest.Layers)
	if layerCount <= 0 {
		log.WithField("ref", ref).Error("image has no layers - cannot serve its blob")
		return nil, errdefs.ErrNotFound
	}
	if layerCount > 1 {
		log.WithField("ref", ref).Warn("image has more than one layers - serving from first layer only")
	}
	blobLayer := manifest.Layers[0]
	return &blobLayer, nil
}
