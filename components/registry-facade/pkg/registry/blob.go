// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/containerd/containerd/content"
	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	distv2 "github.com/docker/distribution/registry/api/v2"
	"github.com/gorilla/handlers"
	files "github.com/ipfs/go-ipfs-files"
	icorepath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/opentracing/opentracing-go"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/registry-facade/api"
)

func (reg *Registry) handleBlob(ctx context.Context, r *http.Request) http.Handler {
	spname, name := getSpecProviderName(ctx)
	sp, ok := reg.SpecProvider[spname]
	if !ok {
		log.WithField("specProvName", spname).Error("unknown spec provider")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			respondWithError(w, distv2.ErrorCodeManifestUnknown)
		})
	}
	spec, err := sp.GetSpec(ctx, name)
	if err != nil {
		log.WithError(err).WithField("specProvName", spname).WithField("name", name).Error("cannot get spec")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			respondWithError(w, distv2.ErrorCodeManifestUnknown)
		})
	}

	dgst, err := digest.Parse(getDigest(ctx))
	if err != nil {
		log.WithError(err).WithField("instanceId", name).Error("cannot get workspace details")
	}

	blobHandler := &blobHandler{
		Context: ctx,
		Digest:  dgst,
		Name:    name,

		Spec:     spec,
		Resolver: reg.Resolver(),
		Store:    reg.Store,
		IPFS:     reg.IPFS,
		AdditionalSources: []BlobSource{
			reg.LayerSource,
		},
		ConfigModifier: reg.ConfigModifier,

		Metrics: reg.metrics,
	}

	mhandler := handlers.MethodHandler{
		"GET":  http.HandlerFunc(blobHandler.getBlob),
		"HEAD": http.HandlerFunc(blobHandler.getBlob),
	}
	res := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reg.metrics.BlobCounter.Inc()
		mhandler.ServeHTTP(w, r)
	})

	return res
}

type blobHandler struct {
	Context context.Context
	Digest  digest.Digest
	Name    string

	Spec              *api.ImageSpec
	Resolver          remotes.Resolver
	Store             BlobStore
	IPFS              *IPFSBlobCache
	AdditionalSources []BlobSource
	ConfigModifier    ConfigModifier

	Metrics *metrics
}

var bufPool = sync.Pool{
	New: func() interface{} {
		// setting to 4096 to align with PIPE_BUF
		// http://man7.org/linux/man-pages/man7/pipe.7.html
		buffer := make([]byte, 4096)
		return &buffer
	},
}

func (bh *blobHandler) getBlob(w http.ResponseWriter, r *http.Request) {
	// v2.ErrorCodeBlobUnknown.WithDetail(bh.Digest)
	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(r.Context(), "getBlob")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err := func() error {
		// TODO: rather than download the same manifest over and over again,
		//       we should add it to the store and try and fetch it from there.
		//		 Only if the store fetch fails should we attetmpt to download it.
		manifest, fetcher, err := bh.downloadManifest(ctx, bh.Spec.BaseRef)
		if err != nil {
			return err
		}

		var srcs []BlobSource

		// 1. local store (faster)
		srcs = append(srcs, storeBlobSource{Store: bh.Store})

		// 2. IPFS (if configured)
		if bh.IPFS != nil {
			ipfsSrc := ipfsBlobSource{source: bh.IPFS}
			srcs = append(srcs, ipfsSrc)
		}

		// 3. upstream registry
		srcs = append(srcs, proxyingBlobSource{Fetcher: fetcher, Blobs: manifest.Layers})

		srcs = append(srcs, &configBlobSource{Fetcher: fetcher, Spec: bh.Spec, Manifest: manifest, ConfigModifier: bh.ConfigModifier})
		srcs = append(srcs, bh.AdditionalSources...)

		var src BlobSource
		for _, s := range srcs {
			if s.HasBlob(ctx, bh.Spec, bh.Digest) {
				src = s
				break
			}
		}
		if src == nil {
			return distv2.ErrorCodeBlobUnknown
		}

		t0 := time.Now()

		dontCache, mediaType, url, rc, err := src.GetBlob(ctx, bh.Spec, bh.Digest)
		if err != nil {
			return err
		}
		if rc != nil {
			defer rc.Close()
		}

		if url != "" {
			http.Redirect(w, r, url, http.StatusPermanentRedirect)
			return nil
		}

		w.Header().Set("Content-Type", mediaType)
		w.Header().Set("Etag", bh.Digest.String())

		bp := bufPool.Get().(*[]byte)
		defer bufPool.Put(bp)

		n, err := io.CopyBuffer(w, rc, *bp)
		if err != nil {
			bh.Metrics.BlobDownloadCounter.WithLabelValues(src.Name(), "false").Inc()
			log.WithField("blobSource", src.Name()).WithField("baseRef", bh.Spec.BaseRef).WithError(err).Error("unable to return blob")
			return err
		}

		bh.Metrics.BlobDownloadSpeedHist.WithLabelValues(src.Name()).Observe(float64(n) / time.Since(t0).Seconds())
		bh.Metrics.BlobDownloadCounter.WithLabelValues(src.Name(), "true").Inc()
		bh.Metrics.BlobDownloadSizeCounter.WithLabelValues(src.Name()).Add(float64(n))

		if dontCache {
			return nil
		}

		go func() {
			// we can do this only after the io.Copy above. Otherwise we might expect the blob
			// to be in the blobstore when in reality it isn't.
			_, _, _, rc, err := src.GetBlob(context.Background(), bh.Spec, bh.Digest)
			if err != nil {
				log.WithError(err).WithField("digest", bh.Digest).Warn("cannot push to IPFS - unable to get blob")
				return
			}
			if rc == nil {
				log.WithField("digest", bh.Digest).Warn("cannot push to IPFS - blob is nil")
				return
			}

			defer rc.Close()

			err = bh.IPFS.Store(context.Background(), bh.Digest, rc, mediaType)
			if err != nil {
				log.WithError(err).WithField("digest", bh.Digest).Warn("cannot push to IPFS")
			}
		}()

		return nil
	}()

	if err != nil {
		log.WithError(err).Error("cannot get blob")
		respondWithError(w, err)
	}
	tracing.FinishSpan(span, &err)
}

func (bh *blobHandler) downloadManifest(ctx context.Context, ref string) (res *ociv1.Manifest, fetcher remotes.Fetcher, err error) {
	_, desc, err := bh.Resolver.Resolve(ctx, ref)
	if err != nil {
		// ErrInvalidAuthorization
		return nil, nil, err
	}

	fetcher, err = bh.Resolver.Fetcher(ctx, ref)
	if err != nil {
		log.WithError(err).WithField("ref", ref).WithField("instanceId", bh.Name).Error("cannot get fetcher")
		return nil, nil, err
	}
	res, _, err = DownloadManifest(ctx, AsFetcherFunc(fetcher), desc, WithStore(bh.Store))
	return
}

type reader struct {
	content.ReaderAt
	off int64
}

func (r *reader) Read(b []byte) (n int, err error) {
	n, err = r.ReadAt(b, r.off)
	r.off += int64(n)
	return
}

// BlobSource can provide blobs for download
type BlobSource interface {
	// HasBlob checks if a digest can be served by this blob source
	HasBlob(ctx context.Context, details *api.ImageSpec, dgst digest.Digest) bool

	// GetBlob provides access to a blob. If a ReadCloser is returned the receiver is expected to
	// call close on it eventually.
	GetBlob(ctx context.Context, details *api.ImageSpec, dgst digest.Digest) (dontCache bool, mediaType string, url string, data io.ReadCloser, err error)

	// Name identifies the blob source in metrics
	Name() string
}

type storeBlobSource struct {
	Store BlobStore
}

func (sbs storeBlobSource) Name() string {
	return "blobstore"
}

func (sbs storeBlobSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	_, err := sbs.Store.Info(ctx, dgst)
	return err == nil
}

func (sbs storeBlobSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (dontCache bool, mediaType string, url string, data io.ReadCloser, err error) {
	info, err := sbs.Store.Info(ctx, dgst)
	if err != nil {
		return
	}

	r, err := sbs.Store.ReaderAt(ctx, ociv1.Descriptor{Digest: dgst})
	if err != nil {
		return
	}

	return false, info.Labels["Content-Type"], "", &reader{ReaderAt: r}, nil
}

type proxyingBlobSource struct {
	Fetcher remotes.Fetcher
	Blobs   []ociv1.Descriptor
}

func (sbs proxyingBlobSource) Name() string {
	return "proxy"
}

func (pbs proxyingBlobSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	for _, b := range pbs.Blobs {
		if b.Digest == dgst {
			return true
		}
	}
	return false
}

func (pbs proxyingBlobSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (dontCache bool, mediaType string, url string, data io.ReadCloser, err error) {
	var src ociv1.Descriptor
	for _, b := range pbs.Blobs {
		if b.Digest == dgst {
			src = b
			break
		}
	}
	if src.Digest == "" {
		err = errdefs.ErrNotFound
		return
	}

	r, err := pbs.Fetcher.Fetch(ctx, src)
	if err != nil {
		return
	}
	return false, src.MediaType, "", r, nil
}

type configBlobSource struct {
	Fetcher        remotes.Fetcher
	Spec           *api.ImageSpec
	Manifest       *ociv1.Manifest
	ConfigModifier ConfigModifier
}

func (sbs configBlobSource) Name() string {
	return "config"
}

func (pbs *configBlobSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	cfg, err := pbs.getConfig(ctx)
	if err != nil {
		log.WithError(err).Error("cannot (re-)produce image config")
		return false
	}

	cfgDgst := digest.FromBytes(cfg)
	return cfgDgst == dgst
}

func (pbs *configBlobSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (dontCache bool, mediaType string, url string, data io.ReadCloser, err error) {
	if !pbs.HasBlob(ctx, spec, dgst) {
		err = distv2.ErrorCodeBlobUnknown
		return
	}

	cfg, err := pbs.getConfig(ctx)
	if err != nil {
		return
	}
	mediaType = pbs.Manifest.Config.MediaType
	data = io.NopCloser(bytes.NewReader(cfg))
	return
}

func (pbs *configBlobSource) getConfig(ctx context.Context) (rawCfg []byte, err error) {
	manifest := *pbs.Manifest
	cfg, err := DownloadConfig(ctx, AsFetcherFunc(pbs.Fetcher), "", manifest.Config)
	if err != nil {
		return
	}

	_, err = pbs.ConfigModifier(ctx, pbs.Spec, cfg)
	if err != nil {
		return
	}

	rawCfg, err = json.Marshal(cfg)
	return
}

type ipfsBlobSource struct {
	source *IPFSBlobCache
}

func (sbs ipfsBlobSource) Name() string {
	return "ipfs"
}

func (sbs ipfsBlobSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	_, err := sbs.source.Redis.Get(ctx, dgst.String()).Result()
	return err == nil
}

func (sbs ipfsBlobSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (dontCache bool, mediaType string, url string, data io.ReadCloser, err error) {
	log := log.WithField("digest", dgst)

	ipfsCID, err := sbs.source.Redis.Get(ctx, dgst.String()).Result()
	if err != nil {
		log.WithError(err).Error("unable to get blob details from Redis")
		err = distv2.ErrorCodeBlobUnknown
		return
	}

	ipfsFile, err := sbs.source.IPFS.Unixfs().Get(ctx, icorepath.New(ipfsCID))
	if err != nil {
		log.WithError(err).Error("unable to get blob from IPFS")
		err = distv2.ErrorCodeBlobUnknown
		return
	}

	f, ok := ipfsFile.(interface {
		files.File
		io.ReaderAt
	})
	if !ok {
		log.WithError(err).Error("IPFS file does not support io.ReaderAt")
		err = distv2.ErrorCodeBlobUnknown
		return
	}

	mediaType, err = sbs.source.Redis.Get(ctx, mediaTypeKeyFromDigest(dgst)).Result()
	if err != nil {
		log.WithError(err).Error("cannot get media type from Redis")
		err = distv2.ErrorCodeBlobUnknown
		return
	}

	log.Debug("returning blob from IPFS")
	return true, mediaType, "", f, nil
}

func mediaTypeKeyFromDigest(dgst digest.Digest) string {
	return "mtype:" + dgst.String()
}
