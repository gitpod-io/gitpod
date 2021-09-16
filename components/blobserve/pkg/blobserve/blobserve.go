// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"

	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	"github.com/docker/distribution/reference"
	"github.com/gorilla/mux"
	"golang.org/x/xerrors"

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

type BlobserveInlineVars struct {
	IDE             string `json:"ide"`
	SupervisorImage string `json:"supervisor"`
}

type BlobSpace struct {
	Location string `json:"location"`
	MaxSize  int64  `json:"maxSizeBytes,omitempty"`
}

type Repo struct {
	PrePull      []string            `json:"prePull,omitempty"`
	Workdir      string              `json:"workdir,omitempty"`
	Replacements []StringReplacement `json:"replacements,omitempty"`
	InlineStatic []InlineReplacement `json:"inlineStatic,omitempty"`
}

// Config configures a server.
type Config struct {
	Port    int             `json:"port"`
	Timeout util.Duration   `json:"timeout,omitempty"`
	Repos   map[string]Repo `json:"repos"`
	// AllowAnyRepo enables users to access any repo/image, irregardles if they're listed in the
	// ref config or not.
	AllowAnyRepo bool      `json:"allowAnyRepo"`
	BlobSpace    BlobSpace `json:"blobSpace"`
}

type StringReplacement struct {
	Path        string `json:"path"`
	Search      string `json:"search"`
	Replacement string `json:"replacement"`
}

type InlineReplacement struct {
	Search      string `json:"search"`
	Replacement string `json:"replacement"`
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
	defer func() {
		if err := recover(); err != nil {
			path := ""
			if req != nil && req.URL != nil {
				path = req.URL.Path
			}
			log.
				WithField("path", path).
				Errorf("panic in blobserve request handling: %v\n%s", err, debug.Stack())
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}
	}()

	vars := mux.Vars(req)
	image := vars["image"]
	pref, err := reference.ParseNamed(image)
	if err != nil {
		http.Error(w, fmt.Sprintf("cannot parse image '%q': %q", html.EscapeString(image), err), http.StatusNotFound)
		return
	}
	repo := pref.Name()
	var tag string
	if refTagged, ok := pref.(reference.Tagged); ok {
		tag = refTagged.Tag()
	} else {
		http.Error(w, fmt.Sprintf("cannot parse image '%q': tag is missing", html.EscapeString(image)), http.StatusNotFound)
		return
	}

	var workdir string
	var inlineReplacements []InlineReplacement
	if cfg, ok := reg.Config.Repos[repo]; ok {
		workdir = cfg.Workdir
		inlineReplacements = cfg.InlineStatic
	} else if !reg.Config.AllowAnyRepo {
		log.WithField("repo", repo).Debug("forbidden repo access attempt")
		http.Error(w, fmt.Sprintf("forbidden repo: %q", html.EscapeString(repo)), http.StatusForbidden)
		return
	}

	ref := fmt.Sprintf("%s:%s", repo, tag)

	// The blobFor operation's context must be independent of this request. Even if we do not
	// serve this request in time, we might want to serve another from the same ref in the future.
	blob, hash, err := reg.refstore.BlobFor(context.Background(), ref, req.Header.Get("X-BlobServe-ReadOnly") == "true")
	if err == errdefs.ErrNotFound {
		http.Error(w, fmt.Sprintf("image %s not found: %q", html.EscapeString(ref), err), http.StatusNotFound)
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
	imagePath := strings.TrimPrefix(req.URL.Path, pathPrefix)
	if imagePath == "/index.html" || imagePath == "/" {
		fn := filepath.Join(workdir, "index.html")

		fc, err := blob.Open(fn)
		if err != nil {
			log.WithError(err).WithField("fn", fn).Error("cannot stat index.html")
			http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
			return
		}
		defer fc.Close()

		var modTime time.Time
		if s, err := fc.Stat(); err == nil {
			modTime = s.ModTime()
		}

		content, err := inlineVars(req, fc, inlineReplacements)
		if err != nil {
			log.WithError(err).Error()
		}
		http.ServeContent(w, req, "index.html", modTime, content)
		return
	}

	var fs http.FileSystem
	fs = blob
	if workdir != "" {
		fs = prefixingFilesystem{Prefix: workdir, FS: fs}
	}
	http.StripPrefix(pathPrefix, http.FileServer(fs)).ServeHTTP(w, req)
}

func inlineVars(req *http.Request, r io.ReadSeeker, inlineReplacements []InlineReplacement) (io.ReadSeeker, error) {
	inlineVarsValue := req.Header.Get("X-BlobServe-InlineVars")
	if len(inlineReplacements) == 0 || inlineVarsValue == "" {
		return r, nil
	}

	var inlineVars BlobserveInlineVars
	err := json.Unmarshal([]byte(inlineVarsValue), &inlineVars)
	if err != nil {
		return r, xerrors.Errorf("cannot parse inline vars: %w: %s", err, inlineVars)
	}

	content, err := ioutil.ReadAll(r)
	if err != nil {
		return r, xerrors.Errorf("cannot read index.html: %w", err)
	}

	for _, replacement := range inlineReplacements {
		replace := strings.ReplaceAll(strings.ReplaceAll(replacement.Replacement, "${ide}", inlineVars.IDE), "${supervisor}", inlineVars.SupervisorImage)
		content = bytes.ReplaceAll(content, []byte(replacement.Search), []byte(replace))
	}
	return bytes.NewReader(content), nil
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
