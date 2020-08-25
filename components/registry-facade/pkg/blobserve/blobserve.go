// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/containerd/containerd/errdefs"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/registry-facade/pkg/registry"
	"github.com/gorilla/mux"
	"golang.org/x/xerrors"
)

// Server offers image blobs for download
type Server struct {
	Config   Config
	Resolver registry.ResolverProvider

	blobspace *blobspace
	refcache  map[string]string
	mu        sync.RWMutex
}

// Config configures a server.
// Mapping maps a single path prefix to an image name, e.g.
//    { "theia": "eu.gcr.io/typefox/gitpod/theia-ide:" } maps an incoming request from
//    /theia/foobar.1/index.html to a file named index.html in the first layer blob of
//    the eu.gcr.io/typefox/gitpod/theia-ide:foobar.1 image.
type Config struct {
	Port    int           `json:"port"`
	Timeout util.Duration `json:"timeout,omitempty"`
	Mapping map[string]struct {
		Repository string `json:"repo"`
		Workdir    string `json:"workdir,omitempty"`
	} `json:"mapping"`
	Preparation []string `json:"preparation,omitempty"`
	BlobSpace   struct {
		Location string `json:"location"`
		MaxSize  int64  `json:"maxSizeBytes,omitempty"`
	} `json:"blobSpace"`
}

// NewServer creates a new blob server
func NewServer(cfg Config, resolver registry.ResolverProvider) (*Server, error) {
	bs, err := newBlobSpace(cfg.BlobSpace.Location, cfg.BlobSpace.MaxSize, 10*time.Minute)
	if err != nil {
		return nil, err
	}

	s := &Server{
		Config:    cfg,
		Resolver:  resolver,
		blobspace: bs,
		refcache:  make(map[string]string),
	}
	for _, ref := range cfg.Preparation {
		log.WithField("ref", ref).Info("preparing blob server")
		err := s.Prepare(context.Background(), ref)
		if err != nil {
			return nil, err
		}
	}
	return s, nil
}

// Serve serves the registry on the given port
func (reg *Server) Serve() error {
	r := mux.NewRouter()
	r.PathPrefix("/{prefix:[a-z]+}/{tag:[a-z][a-z0-9-\\.]*}").HandlerFunc(reg.serve)

	var h http.Handler = r
	if reg.Config.Timeout > 0 {
		h = http.TimeoutHandler(h, time.Duration(reg.Config.Timeout), "timeout")
	}

	log.WithField("addr", fmt.Sprintf(":%d", reg.Config.Port)).Info("blob HTTP server listening")
	return http.ListenAndServe(fmt.Sprintf(":%d", reg.Config.Port), h)
}

// MustServe calls serve and logs any error as Fatal
func (reg *Server) MustServe() {
	err := reg.Serve()
	if err != nil {
		log.WithError(err).Fatal("cannot serve registry")
	}
}

// serve serves a single file from an image
func (reg *Server) serve(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	prefix, tag := vars["prefix"], vars["tag"]

	mapping, ok := reg.Config.Mapping[prefix]
	if !ok {
		http.Error(w, fmt.Sprintf("unknown mapping: %s", mapping), http.StatusNotFound)
		return
	}

	ref := fmt.Sprintf("%s:%s", strings.TrimPrefix(mapping.Repository, ":"), tag)

	// The blobFor operation's context must be independent of this request. Even if we do not
	// serve this request in time, we might want to serve another from the same ref in the future.
	blob, err := reg.blobFor(context.Background(), ref)
	if err == errdefs.ErrNotFound {
		http.Error(w, fmt.Sprintf("image %s not found: %q", ref, err), http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, fmt.Sprintf("internal error: %q", err), http.StatusInternalServerError)
		return
	}

	var fs http.FileSystem
	fs = blob
	if mapping.Workdir != "" {
		fs = prefixingFilesystem{Prefix: mapping.Workdir, FS: fs}
	}

	http.StripPrefix(fmt.Sprintf("/%s/%s", prefix, tag), http.FileServer(fs)).ServeHTTP(w, req)
}

// Prepare downloads a blob and prepares it for use independently of any request
func (reg *Server) Prepare(ctx context.Context, ref string) (err error) {
	_, err = reg.blobFor(ctx, ref)
	return
}

func (reg *Server) blobFor(ctx context.Context, ref string) (fs http.FileSystem, err error) {
	reg.mu.RLock()
	dgst := reg.refcache[ref]
	reg.mu.RUnlock()

	if dgst == "" {
		return reg.downloadBlobFor(ctx, ref)
	}

	fs, state := reg.blobspace.Get(dgst)
	if state != blobReady {
		return nil, xerrors.Errorf("unready blob for %s", dgst)
	}

	return fs, nil
}

func (reg *Server) downloadBlobFor(ctx context.Context, ref string) (fs http.FileSystem, err error) {
	resolver := reg.Resolver()
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

	if len(manifest.Layers) == 0 {
		log.WithField("ref", ref).Error("image has no layers - cannot serve its blob")
		return nil, errdefs.ErrNotFound
	}
	if len(manifest.Layers) > 1 {
		log.WithField("ref", ref).Warn("image has more than one layers - serving from first layer only")
	}
	blobLayer := manifest.Layers[0]
	dgst := blobLayer.Digest.Hex()

	for {
		fs, state := reg.blobspace.Get(dgst)
		switch state {
		case blobUnknown:
			in, err := fetcher.Fetch(ctx, blobLayer)
			defer in.Close()
			if err != nil {
				return nil, err
			}

			log.WithField("digest", dgst).WithField("ref", ref).Info("downloading blob to serve over HTTP")
			err = reg.blobspace.AddFromTarGzip(ctx, dgst, in)
			if err != nil {
				return nil, xerrors.Errorf("cannot download blob: %w", err)
			}

		case blobUnready:
			if ctx.Err() != nil {
				return nil, err
			}

			// TODO: replace busy waiting on the blob becoming available with something mutex/channel based
			time.Sleep(500 * time.Millisecond)

		case blobReady:
			reg.mu.Lock()
			reg.refcache[ref] = dgst
			reg.mu.Unlock()
			return fs, nil
		}
	}
}

type prefixingFilesystem struct {
	Prefix string
	FS     http.FileSystem
}

func (p prefixingFilesystem) Open(name string) (http.File, error) {
	return p.FS.Open(filepath.Join(p.Prefix, name))
}
