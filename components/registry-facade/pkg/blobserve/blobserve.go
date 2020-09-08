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
type Config struct {
	Port    int           `json:"port"`
	Timeout util.Duration `json:"timeout,omitempty"`
	Repos   map[string]struct {
		PrePull []string `json:"prePull,omitempty"`
		Workdir string   `json:"workdir,omitempty"`
	} `json:"repos"`
	// AllowAnyRepo enables users to access any repo/image, irregardles if they're listed in the
	// ref config or not.
	AllowAnyRepo bool `json:"allowAnyRepo"`
	BlobSpace    struct {
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
	for repo, repoCfg := range cfg.Repos {
		for _, ver := range repoCfg.PrePull {
			ref := repo + ":" + ver
			log.WithField("ref", ref).Info("preparing blob server")
			err := s.Prepare(context.Background(), ref)
			if err != nil {
				return nil, err
			}
		}
	}
	return s, nil
}

// Serve serves the registry on the given port
func (reg *Server) Serve() error {
	r := mux.NewRouter()
	r.PathPrefix(`/{repo:[a-zA-Z0-9\/\-\.]+}:{tag:[a-z][a-z0-9-\.]+}`).MatcherFunc(isNoWebsocketRequest).HandlerFunc(reg.serve)
	r.NewRoute().HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
		log.WithField("path", req.URL.Path).Warn("unmapped request")
		http.Error(resp, http.StatusText(http.StatusNotFound), http.StatusNotFound)
	})

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
	repo, tag := vars["repo"], vars["tag"]

	var workdir string
	if cfg, ok := reg.Config.Repos[repo]; ok {
		workdir = cfg.Workdir
	} else if !reg.Config.AllowAnyRepo {
		log.WithField("repo", repo).Debug("forbidden repo access attempt")
		http.Error(w, fmt.Sprintf("forbidden repo: %s", repo), http.StatusForbidden)
		return
	}

	ref := fmt.Sprintf("%s:%s", repo, tag)

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

	log.WithField("path", req.URL.Path).Debug("handling blobserve")
	pathPrefix := fmt.Sprintf("/%s:%s", repo, tag)
	if req.URL.Path == pathPrefix {
		req.URL.Path += "/"
	}

	// http.FileServer has a special case where ServeFile redirects any request where r.URL.Path
	// ends in "/index.html" to the same path, without the final "index.html".
	// We do not want this behaviour to make the gitpod-ide-index mechanism in ws-proxy work.
	if strings.TrimPrefix(req.URL.Path, pathPrefix) == "/index.html" {
		fn := filepath.Join(workdir, "index.html")

		fc, err := blob.Open(fn)
		if err != nil {
			log.WithError(err).WithField("fn", fn).Debug("cannot stat index.html")
			http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
			return
		}
		defer fc.Close()

		var modTime time.Time
		if s, err := fc.Stat(); err == nil {
			modTime = s.ModTime()
		}

		http.ServeContent(w, req, "index.html", modTime, fc)
		return
	}

	var fs http.FileSystem
	fs = blob
	if workdir != "" {
		fs = prefixingFilesystem{Prefix: workdir, FS: fs}
	}
	http.StripPrefix(pathPrefix, http.FileServer(fs)).ServeHTTP(w, req)
}

func isNoWebsocketRequest(req *http.Request, match *mux.RouteMatch) bool {
	if strings.ToLower(req.Header.Get("Connection")) == "upgrade" {
		return false
	}
	if strings.ToLower(req.Header.Get("Upgrade")) == "websocket" {
		return false
	}
	return true
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
	// TODO(cw): If multiple requests are made while the download happens we'll start multiple downloads (one per request).
	//           Instead we should properly sync/manage/timeout state here.

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
