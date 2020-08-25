// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"mime"
	"net/http"
	"strings"

	"github.com/containerd/containerd/content"
	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/images"
	"github.com/containerd/containerd/remotes"
	distv2 "github.com/docker/distribution/registry/api/v2"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gorilla/handlers"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/pkg/errors"
)

func (reg *Registry) handleManifest(ctx context.Context, r *http.Request) http.Handler {
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

	manifestHandler := &manifestHandler{
		Context:        ctx,
		Name:           name,
		Spec:           spec,
		Resolver:       reg.Resolver(),
		Store:          reg.Store,
		ConfigModifier: reg.ConfigModifier,
	}
	reference := getReference(ctx)
	dgst, err := digest.Parse(reference)
	if err != nil {
		manifestHandler.Tag = reference
	} else {
		manifestHandler.Digest = dgst
	}

	mhandler := handlers.MethodHandler{
		"GET":    http.HandlerFunc(manifestHandler.getManifest),
		"HEAD":   http.HandlerFunc(manifestHandler.getManifest),
		"PUT":    http.HandlerFunc(manifestHandler.putManifest),
		"DELETE": http.HandlerFunc(manifestHandler.deleteManifest),
	}

	return mhandler
}

type manifestHandler struct {
	Context context.Context

	Spec           *api.ImageSpec
	Resolver       remotes.Resolver
	Store          content.Store
	ConfigModifier ConfigModifier

	Name   string
	Tag    string
	Digest digest.Digest
}

func (mh *manifestHandler) getManifest(w http.ResponseWriter, r *http.Request) {
	span, ctx := opentracing.StartSpanFromContext(r.Context(), "getManifest")
	err := func() error {
		log.WithField("spec", mh.Spec).Debug("get manifest")
		tracing.LogMessageSafe(span, "spec", mh.Spec)

		var (
			acceptType string
			err        error
		)
		for _, acceptHeader := range r.Header["Accept"] {
			for _, mediaType := range strings.Split(acceptHeader, ",") {
				if mediaType, _, err = mime.ParseMediaType(strings.TrimSpace(mediaType)); err != nil {
					continue
				}

				if mediaType == ociv1.MediaTypeImageManifest || mediaType == "*" {
					acceptType = ociv1.MediaTypeImageManifest
					break
				}
			}
			if acceptType != "" {
				break
			}
		}
		if acceptType == "" {
			return distv2.ErrorCodeManifestUnknown.WithMessage("Accept header does not include OCIv1 or v2 manifests")
		}

		// Note: we ignore the mh.Digest for now because we always return a manifest, never a manifest index.
		ref := mh.Spec.BaseRef

		_, desc, err := mh.Resolver.Resolve(ctx, ref)
		if err != nil {
			// ErrInvalidAuthorization
			return err
		}

		fetcher, err := mh.Resolver.Fetcher(ctx, ref)
		if err != nil {
			log.WithError(err).WithField("ref", ref).WithField("instanceId", mh.Name).Error("cannot get fetcher")
			return distv2.ErrorCodeManifestUnknown.WithDetail(err)
		}
		rc, err := fetcher.Fetch(ctx, desc)
		if err != nil {
			log.WithError(err).WithField("ref", ref).WithField("instanceId", mh.Name).Error("cannot fetch manifest")
			return distv2.ErrorCodeManifestUnknown.WithDetail(err)
		}
		defer rc.Close()

		manifest, ndesc, err := DownloadManifest(ctx, fetcher, desc, WithStore(mh.Store))
		if err != nil {
			return distv2.ErrorCodeManifestUnknown.WithDetail(err)
		}
		desc = *ndesc

		var p []byte
		switch desc.MediaType {
		case images.MediaTypeDockerSchema2Manifest, ociv1.MediaTypeImageManifest:
			// download config
			cfg, err := downloadConfig(ctx, fetcher, manifest.Config)
			if err != nil {
				return err
			}

			// modify config
			addonLayer, err := mh.ConfigModifier(ctx, mh.Spec, cfg)
			if err != nil {
				return err
			}
			manifest.Layers = append(manifest.Layers, addonLayer...)

			// place config in store
			rawCfg, err := json.Marshal(cfg)
			if err != nil {
				return err
			}
			cfgDgst := digest.FromBytes(rawCfg)

			// optimization: we store the config in the store just in case the client attempts to download the config blob
			// 				 from us. If they download it from a registry facade from which the manifest hasn't been downloaded
			//               we'll re-create the config on the fly.
			if w, err := mh.Store.Writer(ctx, content.WithRef(ref), content.WithDescriptor(desc)); err == nil {
				defer w.Close()

				_, err = w.Write(rawCfg)
				if err != nil {
					log.WithError(err).Warn("cannot write config to store - we'll regenerate it on demand")
				}
				err = w.Commit(ctx, 0, cfgDgst)
				if err != nil {
					log.WithError(err).Warn("cannot commit config to store - we'll regenerate it on demand")
				}
			}

			// update config digest in manifest
			manifest.Config.Digest = cfgDgst
			manifest.Config.URLs = nil
			manifest.Config.Size = int64(len(rawCfg))

			p, _ = json.Marshal(manifest)
		}

		dgst := digest.FromBytes(p).String()
		span.LogKV("manifest", string(p))

		w.Header().Set("Content-Type", desc.MediaType)
		w.Header().Set("Content-Length", fmt.Sprint(len(p)))
		w.Header().Set("Etag", fmt.Sprintf(`"%s"`, dgst))
		w.Header().Set("Docker-Content-Digest", dgst)
		w.Write(p)

		log.WithField("name", mh.Name).WithField("tag", mh.Tag).Debug("get manifest")
		return nil
	}()

	if err != nil {
		log.WithError(err).WithField("spec", mh.Spec).Error("cannot get manifest")
		respondWithError(w, err)
	}
	tracing.FinishSpan(span, &err)
}

func downloadConfig(ctx context.Context, fetcher remotes.Fetcher, desc ociv1.Descriptor) (cfg *ociv1.Image, err error) {
	if desc.MediaType != images.MediaTypeDockerSchema2Config &&
		desc.MediaType != ociv1.MediaTypeImageConfig {

		return nil, fmt.Errorf("unsupported media type")
	}

	rc, err := fetcher.Fetch(ctx, desc)
	if err != nil {
		return nil, fmt.Errorf("cannot download config: %w", err)
	}
	defer rc.Close()

	var res ociv1.Image
	err = json.NewDecoder(rc).Decode(&res)
	if err != nil {
		return nil, fmt.Errorf("cannot decode config: %w", err)
	}

	return &res, nil
}

type manifestDownloadOptions struct {
	Store content.Store
}

// ManifestDownloadOption alters the default manifest download behaviour
type ManifestDownloadOption func(*manifestDownloadOptions)

// WithStore caches a downloaded manifest in a store
func WithStore(store content.Store) ManifestDownloadOption {
	return func(o *manifestDownloadOptions) {
		o.Store = store
	}
}

// DownloadManifest downloads and unmarshals the manifest of the given desc. If the desc points to manifest list
// we choose the first manifest in that list.
func DownloadManifest(ctx context.Context, fetcher remotes.Fetcher, desc ociv1.Descriptor, options ...ManifestDownloadOption) (cfg *ociv1.Manifest, rdesc *ociv1.Descriptor, err error) {
	var opts manifestDownloadOptions
	for _, o := range options {
		o(&opts)
	}

	var (
		rc           io.ReadCloser
		placeInStore bool
	)
	if opts.Store != nil {
		r, err := opts.Store.ReaderAt(ctx, desc)
		if errors.Cause(err) == errdefs.ErrNotFound {
			// not in store yet
		} else if err != nil {
			log.WithError(err).WithField("desc", desc).Warn("cannot get manifest from store")
		} else {
			rc = &reader{ReaderAt: r}
		}
	}
	if rc == nil {
		placeInStore = true
		rc, err = fetcher.Fetch(ctx, desc)
		if err != nil {
			err = fmt.Errorf("cannot download manifest: %w", err)
			return
		}
	}

	inpt, err := ioutil.ReadAll(rc)
	rc.Close()
	if err != nil {
		err = fmt.Errorf("cannot download manifest: %w", err)
		return
	}

	rdesc = &desc

	switch rdesc.MediaType {
	case images.MediaTypeDockerSchema2ManifestList, ociv1.MediaTypeImageIndex:
		// we received a manifest list which means we'll pick the default platform
		// and fetch that manifest
		var list ociv1.Index
		err = json.Unmarshal(inpt, &list)
		if err != nil {
			err = fmt.Errorf("cannot unmarshal index: %w", err)
			return
		}
		if len(list.Manifests) == 0 {
			err = fmt.Errorf("empty manifest")
			return
		}

		// TODO: choose by platform, not just the first manifest
		md := list.Manifests[0]
		rc, err = fetcher.Fetch(ctx, md)
		if err != nil {
			err = fmt.Errorf("cannot download config: %w", err)
			return
		}
		rdesc = &md
		inpt, err = ioutil.ReadAll(rc)
		rc.Close()
		if err != nil {
			err = fmt.Errorf("cannot download manifest: %w", err)
			return
		}
	}

	switch rdesc.MediaType {
	case images.MediaTypeDockerSchema2Manifest, ociv1.MediaTypeImageManifest:
	default:
		err = fmt.Errorf("unsupported media type")
		return
	}

	var res ociv1.Manifest
	err = json.Unmarshal(inpt, &res)
	if err != nil {
		err = fmt.Errorf("cannot decode config: %w", err)
		return
	}

	if opts.Store != nil && placeInStore {
		// We're cheating here and store the actual image manifest under the desc of what's
		// possibly an image index. This way we don't have to resolve the image index the next
		// time one wishes to resolve desc.
		w, err := opts.Store.Writer(ctx, content.WithDescriptor(desc), content.WithRef(desc.Digest.String()))
		if err != nil {
			log.WithError(err).WithField("desc", *rdesc).Warn("cannot store manifest")
		} else {
			_, err = io.Copy(w, bytes.NewReader(inpt))
			if err != nil {
				log.WithError(err).WithField("desc", *rdesc).Warn("cannot store manifest")
			}

			err = w.Commit(ctx, 0, digest.FromBytes(inpt))
			if err != nil {
				log.WithError(err).WithField("desc", *rdesc).Warn("cannot store manifest")
			}
			w.Close()
		}
	}

	cfg = &res
	return
}

func (mh *manifestHandler) putManifest(w http.ResponseWriter, r *http.Request) {
	respondWithError(w, distv2.ErrorCodeManifestInvalid)
}

func (mh *manifestHandler) deleteManifest(w http.ResponseWriter, r *http.Request) {
	respondWithError(w, distv2.ErrorCodeManifestUnknown)
}
