// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	"github.com/docker/distribution/reference"
	"github.com/gorilla/mux"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
)

// ResolverProvider provides new resolver
type ResolverProvider func() remotes.Resolver

// Server offers image blobs for download
type Server struct {
	Config   Config
	Resolver ResolverProvider

	refstore *refstore
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
func NewServer(cfg Config, resolver ResolverProvider) (*Server, error) {
	refstore, err := newRefStore(cfg, resolver)
	if err != nil {
		return nil, err
	}

	s := &Server{
		Config:   cfg,
		Resolver: resolver,
		refstore: refstore,
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
	// path must be at least `/image-name:tag` (tag required)
	// could also be like `/my-reg.com:8080/my/special_alpine:1.2.3/`
	// or `/my-reg.com:8080/alpine:1.2.3/additional/path/will/be/ignored.json`
	r.PathPrefix(`/{image:[a-zA-Z0-9_\/\-\.\:]+:[\w\.\-]+}`).MatcherFunc(isNoWebsocketRequest).HandlerFunc(reg.serve)
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
	image := vars["image"]
	pref, err := reference.ParseNamed(image)
	if err != nil {
		http.Error(w, fmt.Sprintf("cannot parse image '%s': %q", image, err), http.StatusNotFound)
		return
	}
	repo := pref.Name()
	var tag string
	if refTagged, ok := pref.(reference.Tagged); ok {
		tag = refTagged.Tag()
	} else {
		http.Error(w, fmt.Sprintf("cannot parse image '%s': tag is missing", image), http.StatusNotFound)
		return
	}

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
	blob, hash, err := reg.refstore.BlobFor(context.Background(), ref, req.Header.Get("X-BlobServe-ReadOnly") == "true")
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

	w.Header().Set("ETag", hash)
	w.Header().Set("Cache-Control", "no-cache")

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
	_, _, err = reg.refstore.BlobFor(ctx, ref, false)
	return
}

type prefixingFilesystem struct {
	Prefix string
	FS     http.FileSystem
}

func (p prefixingFilesystem) Open(name string) (http.File, error) {
	return p.FS.Open(filepath.Join(p.Prefix, name))
}
