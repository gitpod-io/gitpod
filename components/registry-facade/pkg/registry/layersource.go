// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	lru "github.com/hashicorp/golang-lru"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/registry-facade/api"
)

const (
	// labelSkipNLayer is a label on images that tells registry-facade to discard the first N layer.
	// If the value of this label
	//   - is not a number (cannot be parsed by strconv.ParseUint), registry-facade fails to use the image,
	//   - is larger than the number of layers in the image, the image is considered empty (i.e. to have no layer).
	labelSkipNLayer = "skip-n.registry-facade.gitpod.io"
)

// LayerSource provides layers for a workspace image
type LayerSource interface {
	BlobSource
	GetLayer(ctx context.Context, spec *api.ImageSpec) ([]AddonLayer, error)
	Envs(ctx context.Context, spec *api.ImageSpec) ([]EnvModifier, error)
}

// AddonLayer is an OCI descriptor for a layer + the layers diffID
type AddonLayer struct {
	Descriptor ociv1.Descriptor
	DiffID     digest.Digest
}

type filebackedLayer struct {
	AddonLayer
	Filename string
}

// FileLayerSource provides the same layers independent of the workspace spec
type FileLayerSource []filebackedLayer

// Envs returns the list of env modifiers
func (s FileLayerSource) Envs(ctx context.Context, spec *api.ImageSpec) ([]EnvModifier, error) {
	return nil, nil
}

// GetLayer return all layers of this source
func (s FileLayerSource) GetLayer(ctx context.Context, spec *api.ImageSpec) ([]AddonLayer, error) {
	res := make([]AddonLayer, len(s))
	for i := range s {
		res[i] = s[i].AddonLayer
	}
	return res, nil
}

// HasBlob checks if a digest can be served by this blob source
func (s FileLayerSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	for _, l := range s {
		if l.Descriptor.Digest == dgst {
			return true
		}
	}
	return false
}

// GetBlob provides access to a blob. If a ReadCloser is returned the receiver is expected to
// call close on it eventually.
func (s FileLayerSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (mediaType string, url string, data io.ReadCloser, err error) {
	var src filebackedLayer
	for _, l := range s {
		if l.Descriptor.Digest == dgst {
			src = l
			break
		}
	}
	if src.Filename == "" {
		err = errdefs.ErrNotFound
		return
	}

	f, err := os.OpenFile(src.Filename, os.O_RDONLY, 0)
	if os.IsNotExist(err) {
		err = errdefs.ErrNotFound
		return
	}
	if err != nil {
		return
	}

	return src.Descriptor.MediaType, "", f, nil
}

// NewFileLayerSource produces a static layer source where each file is expected to be a gzipped layer
func NewFileLayerSource(ctx context.Context, file ...string) (FileLayerSource, error) {
	var res FileLayerSource
	for _, fn := range file {
		fr, err := os.OpenFile(fn, os.O_RDONLY, 0)
		if err != nil {
			return nil, err
		}
		defer fr.Close()

		stat, err := fr.Stat()
		if err != nil {
			return nil, err
		}

		dgst, err := digest.FromReader(fr)
		if err != nil {
			return nil, err
		}

		// start again to read the diffID
		_, err = fr.Seek(0, 0)
		if err != nil {
			return nil, err
		}
		diffr, err := gzip.NewReader(fr)
		if err != nil {
			return nil, err
		}
		defer diffr.Close()
		diffID, err := digest.FromReader(diffr)
		if err != nil {
			return nil, err
		}

		desc := ociv1.Descriptor{
			MediaType: ociv1.MediaTypeImageLayer,
			Digest:    dgst,
			Size:      stat.Size(),
		}
		res = append(res, filebackedLayer{
			AddonLayer: AddonLayer{
				Descriptor: desc,
				DiffID:     diffID,
			},
			Filename: fn,
		})

		log.WithField("diffID", diffID).WithField("fn", fn).Debug("loaded static layer")
	}

	return res, nil
}

type imagebackedLayer struct {
	AddonLayer
	Fetcher remotes.Fetcher
}

// ImageLayerSource provides additional layers from another image
type ImageLayerSource struct {
	envs   []EnvModifier
	layers []imagebackedLayer
}

// Envs returns the list of env modifiers
func (s ImageLayerSource) Envs(ctx context.Context, spec *api.ImageSpec) ([]EnvModifier, error) {
	return s.envs, nil
}

// GetLayer return all layers of this source
func (s ImageLayerSource) GetLayer(ctx context.Context, spec *api.ImageSpec) ([]AddonLayer, error) {
	res := make([]AddonLayer, len(s.layers))
	for i := range s.layers {
		res[i] = s.layers[i].AddonLayer
	}
	return res, nil
}

// HasBlob checks if a digest can be served by this blob source
func (s ImageLayerSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	for _, l := range s.layers {
		if l.Descriptor.Digest == dgst {
			return true
		}
	}
	return false
}

// GetBlob provides access to a blob. If a ReadCloser is returned the receiver is expected to
// call close on it eventually.
func (s ImageLayerSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (mediaType string, url string, data io.ReadCloser, err error) {
	var src imagebackedLayer
	for _, l := range s.layers {
		if l.Descriptor.Digest == dgst {
			src = l
		}
	}
	if src.Fetcher == nil {
		err = errdefs.ErrNotFound
		return
	}

	rc, err := src.Fetcher.Fetch(ctx, src.Descriptor)
	if err != nil {
		return
	}

	return src.Descriptor.MediaType, "", rc, nil
}

const (
	envPrefixSet     = "GITPOD_ENV_SET_"
	envPrefixAppend  = "GITPOD_ENV_APPEND_"
	envPrefixPrepend = "GITPOD_ENV_PREPEND_"
)

// NewStaticSourceFromImage downloads image layers into the store and uses them as static layer
func NewStaticSourceFromImage(ctx context.Context, resolver remotes.Resolver, ref string) (*ImageLayerSource, error) {
	_, desc, err := resolver.Resolve(ctx, ref)
	if err != nil {
		return nil, err
	}
	fetcher, err := resolver.Fetcher(ctx, ref)
	if err != nil {
		return nil, err
	}

	manifest, _, err := DownloadManifest(ctx, fetcher, desc)
	if err != nil {
		return nil, err
	}

	cfg, err := DownloadConfig(ctx, fetcher, manifest.Config)
	if err != nil {
		return nil, err
	}

	// images can mark the first N layers as irrelevant.
	// We use labels for that to ship that information with the image.
	skipN, err := getSkipNLabelValue(&cfg.Config)
	if err != nil {
		return nil, err
	}

	res := make([]imagebackedLayer, 0, len(manifest.Layers))
	for i, ml := range manifest.Layers {
		if i < skipN {
			continue
		}

		l := imagebackedLayer{
			AddonLayer: AddonLayer{
				Descriptor: ml,
				DiffID:     cfg.RootFS.DiffIDs[i],
			},
			Fetcher: fetcher,
		}
		res = append(res, l)
	}

	var envs []EnvModifier
	parsedEnvs := parseEnvs(cfg.Config.Env)
	for _, name := range parsedEnvs.keys {
		value := parsedEnvs.values[name]
		if strings.HasPrefix(name, envPrefixAppend) {
			name = strings.TrimPrefix(name, envPrefixAppend)
			if name == "" || value == "" {
				continue
			}
			envs = append(envs, newAppendEnvModifier(name, value))
		} else if strings.HasPrefix(name, envPrefixPrepend) {
			name = strings.TrimPrefix(name, envPrefixPrepend)
			if name == "" || value == "" {
				continue
			}
			envs = append(envs, newPrependEnvModifier(name, value))
		} else if strings.HasPrefix(name, envPrefixSet) {
			name = strings.TrimPrefix(name, envPrefixSet)
			if name == "" {
				continue
			}
			envs = append(envs, newSetEnvModifier(name, value))
		}
	}

	return &ImageLayerSource{
		layers: res,
		envs:   envs,
	}, nil
}

// getSkipNLabelValue returns the parsed label value of the LabelSkipNLayer label.
func getSkipNLabelValue(cfg *ociv1.ImageConfig) (skipN int, err error) {
	v, ok := cfg.Labels[labelSkipNLayer]
	if !ok {
		return 0, nil
	}

	vi, err := strconv.ParseUint(v, 10, 16)
	if err != nil {
		return 0, xerrors.Errorf("skipN layer label: %w", err)
	}
	return int(vi), nil
}

// CompositeLayerSource appends layers from different sources
type CompositeLayerSource []LayerSource

// Envs returns the list of env modifiers
func (cs CompositeLayerSource) Envs(ctx context.Context, spec *api.ImageSpec) ([]EnvModifier, error) {
	var res []EnvModifier
	for _, s := range cs {
		envs, err := s.Envs(ctx, spec)
		if err != nil {
			return nil, err
		}
		res = append(res, envs...)
	}
	return res, nil
}

// GetLayer returns the list of all layers from all sources
func (cs CompositeLayerSource) GetLayer(ctx context.Context, spec *api.ImageSpec) ([]AddonLayer, error) {
	var res []AddonLayer
	for _, s := range cs {
		ls, err := s.GetLayer(ctx, spec)
		if err != nil {
			return nil, err
		}
		res = append(res, ls...)
	}
	return res, nil
}

// HasBlob checks if a digest can be served by this blob source
func (cs CompositeLayerSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	for _, s := range cs {
		if s.HasBlob(ctx, spec, dgst) {
			return true
		}
	}
	return false
}

// GetBlob provides access to a blob. If a ReadCloser is returned the receiver is expected to
// call close on it eventually.
func (cs CompositeLayerSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (mediaType string, url string, data io.ReadCloser, err error) {
	for _, s := range cs {
		if s.HasBlob(ctx, spec, dgst) {
			return s.GetBlob(ctx, spec, dgst)
		}
	}

	err = errdefs.ErrNotFound
	return
}

// RefSource extracts an image reference from an image spec
type RefSource func(*api.ImageSpec) (ref string, err error)

// NewSpecMappedImageSource creates a new spec mapped image source
func NewSpecMappedImageSource(resolver ResolverProvider, refSource RefSource) (*SpecMappedImagedSource, error) {
	cache, err := lru.New(128)
	if err != nil {
		return nil, err
	}
	return &SpecMappedImagedSource{
		RefSource: refSource,
		Resolver:  resolver,
		cache:     cache,
	}, nil
}

// SpecMappedImagedSource provides layers from other images based on the image spec
type SpecMappedImagedSource struct {
	RefSource RefSource
	Resolver  ResolverProvider

	// TODO: add ttl
	cache *lru.Cache
}

// Envs returns the list of env modifiers
func (src *SpecMappedImagedSource) Envs(ctx context.Context, spec *api.ImageSpec) ([]EnvModifier, error) {
	lsrc, err := src.getDelegate(ctx, spec)
	if err != nil {
		return nil, err
	}
	if lsrc == nil {
		return []EnvModifier{}, nil
	}
	return lsrc.Envs(ctx, spec)
}

// GetLayer returns the list of all layers from this source
func (src *SpecMappedImagedSource) GetLayer(ctx context.Context, spec *api.ImageSpec) ([]AddonLayer, error) {
	lsrc, err := src.getDelegate(ctx, spec)
	if err != nil {
		return nil, err
	}
	if lsrc == nil {
		return []AddonLayer{}, nil
	}
	return lsrc.GetLayer(ctx, spec)
}

// HasBlob checks if a digest can be served by this blob source
func (src *SpecMappedImagedSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	lsrc, err := src.getDelegate(ctx, spec)
	if err != nil {
		return false
	}
	if lsrc == nil {
		return false
	}
	return lsrc.HasBlob(ctx, spec, dgst)
}

// GetBlob provides access to a blob. If a ReadCloser is returned the receiver is expected to
// call close on it eventually.
func (src *SpecMappedImagedSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (mediaType string, url string, data io.ReadCloser, err error) {
	lsrc, err := src.getDelegate(ctx, spec)
	if err != nil {
		return
	}
	return lsrc.GetBlob(ctx, spec, dgst)
}

// getDelegate returns the cached layer source delegate computed from the image spec
func (src *SpecMappedImagedSource) getDelegate(ctx context.Context, spec *api.ImageSpec) (LayerSource, error) {
	ref, err := src.RefSource(spec)
	if err != nil {
		return nil, err
	}
	if ref == "" {
		return nil, nil
	}

	if s, ok := src.cache.Get(ref); ok {
		return s.(LayerSource), nil
	}

	lsrc, err := NewStaticSourceFromImage(ctx, src.Resolver(), ref)
	if err != nil {
		return nil, err
	}
	src.cache.Add(ref, lsrc)

	return lsrc, nil
}

// NewContentLayerSource creates a new layer source providing the content layer of an image spec
func NewContentLayerSource() (*ContentLayerSource, error) {
	blobCache, err := lru.New(128)
	if err != nil {
		return nil, err
	}
	return &ContentLayerSource{
		blobCache: blobCache,
	}, nil
}

// ContentLayerSource provides layers from other images based on the image spec
type ContentLayerSource struct {
	blobCache *lru.Cache
}

// Envs returns the list of env modifiers
func (src *ContentLayerSource) Envs(ctx context.Context, spec *api.ImageSpec) ([]EnvModifier, error) {
	return nil, nil
}

// GetLayer returns the list of all layers from this source
func (src *ContentLayerSource) GetLayer(ctx context.Context, spec *api.ImageSpec) ([]AddonLayer, error) {
	res := make([]AddonLayer, len(spec.ContentLayer))
	for i, layer := range spec.ContentLayer {
		if dl := layer.GetDirect(); dl != nil {
			dgst := digest.FromBytes(dl.Content)
			res[i] = AddonLayer{
				Descriptor: ociv1.Descriptor{
					MediaType: ociv1.MediaTypeImageLayer,
					Digest:    dgst,
					Size:      int64(len(dl.Content)),
				},
				DiffID: dgst,
			}
			continue
		}

		if rl := layer.GetRemote(); rl != nil {
			dgst, err := digest.Parse(rl.Digest)
			if err != nil {
				return nil, xerrors.Errorf("cannot parse layer digest %s: %w", rl.Digest, err)
			}
			diffID, err := digest.Parse(rl.DiffId)
			if err != nil {
				return nil, xerrors.Errorf("cannot parse layer diffID %s: %w", rl.DiffId, err)
			}
			var urls []string
			if rl.Url != "" {
				urls = []string{rl.Url}
			}

			res[i] = AddonLayer{
				Descriptor: ociv1.Descriptor{
					MediaType: rl.MediaType,
					Digest:    dgst,
					URLs:      urls,
					Size:      rl.Size,
				},
				DiffID: diffID,
			}
			continue
		}

		return nil, xerrors.Errorf("unknown layer type")
	}
	return res, nil
}

// HasBlob checks if a digest can be served by this blob source
func (src *ContentLayerSource) HasBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) bool {
	if src.blobCache.Contains(dgst) {
		return true
	}
	for _, layer := range spec.ContentLayer {
		if dl := layer.GetDirect(); dl != nil {
			if digest.FromBytes(dl.Content) == dgst {
				return true
			}
		}

		if rl := layer.GetRemote(); rl != nil {
			if rl.Digest == dgst.String() {
				return true
			}
		}
	}
	return false
}

// GetBlob provides access to a blob. If a ReadCloser is returned the receiver is expected to
// call close on it eventually.
func (src *ContentLayerSource) GetBlob(ctx context.Context, spec *api.ImageSpec, dgst digest.Digest) (mediaType string, url string, data io.ReadCloser, err error) {
	if blob, ok := src.blobCache.Get(dgst); ok {
		return ociv1.MediaTypeImageLayer, "", io.NopCloser(bytes.NewReader(blob.([]byte))), nil
	}

	for _, layer := range spec.ContentLayer {
		if dl := layer.GetDirect(); dl != nil {
			if digest.FromBytes(dl.Content) == dgst {
				return ociv1.MediaTypeImageLayer, "", io.NopCloser(bytes.NewReader(dl.Content)), nil
			}
		}

		if rl := layer.GetRemote(); rl != nil {
			if rl.Digest == dgst.String() {
				mt := ociv1.MediaTypeImageLayerGzip
				if rl.DiffId == rl.Digest || rl.DiffId == "" {
					mt = ociv1.MediaTypeImageLayer
				}

				return mt, rl.Url, nil, nil
			}
		}
	}

	err = errdefs.ErrNotFound
	return
}

// ParsedEnvs is parsed image envs configuration
type ParsedEnvs struct {
	keys   []string
	values map[string]string
}

// ParseEnv parses environment variables
func parseEnvs(envs []string) *ParsedEnvs {
	result := ParsedEnvs{
		values: make(map[string]string),
	}
	for _, e := range envs {
		parts := strings.SplitN(e, "=", 2)
		if len(parts) == 0 {
			continue
		}
		key := parts[0]
		var value string
		if len(parts) > 1 {
			value = parts[1]
		}
		result.keys = append(result.keys, key)
		result.values[key] = value
	}
	return &result
}

// Set the give value as a variable's value of the given name
func (envs *ParsedEnvs) Set(name, value string) {
	_, exists := envs.values[name]
	if !exists {
		envs.keys = append(envs.keys, name)
	}
	envs.values[name] = value
}

// Append the given value to a variable's value of the given name
func (envs *ParsedEnvs) Append(name, value string) {
	current, exists := envs.values[name]
	if exists {
		envs.values[name] = value + current
	} else {
		envs.keys = append(envs.keys, name)
		envs.values[name] = value
	}
}

// Prepend the given value to a variable's value of the given name
func (envs *ParsedEnvs) Prepend(name, value string) {
	current, exists := envs.values[name]
	if exists {
		envs.values[name] = current + value
	} else {
		envs.keys = append(envs.keys, name)
		envs.values[name] = value
	}
}

func (envs *ParsedEnvs) serialize() (result []string) {
	for _, key := range envs.keys {
		result = append(result, key+"="+envs.values[key])
	}
	return
}

// EnvModifier modifies an image envs configuration
type EnvModifier func(*ParsedEnvs)

func newSetEnvModifier(name, value string) EnvModifier {
	return func(pe *ParsedEnvs) {
		pe.Set(name, value)
	}
}

func newAppendEnvModifier(name, value string) EnvModifier {
	return func(pe *ParsedEnvs) {
		pe.Append(name, value)
	}
}

func newPrependEnvModifier(name, value string) EnvModifier {
	return func(pe *ParsedEnvs) {
		pe.Prepend(name, value)
	}
}

// NewRevisioningLayerSource produces a new revisioning layer source
func NewRevisioningLayerSource(active LayerSource) *RevisioningLayerSource {
	return &RevisioningLayerSource{
		active: active,
	}
}

type RevisioningLayerSource struct {
	mu     sync.RWMutex
	active LayerSource
	past   []LayerSource
}

func (src *RevisioningLayerSource) Update(s LayerSource) {
	src.mu.Lock()
	defer src.mu.Unlock()

	src.past = append(src.past, src.active)
	src.active = s
}

func (src *RevisioningLayerSource) GetLayer(ctx context.Context, spec *api.ImageSpec) ([]AddonLayer, error) {
	src.mu.RLock()
	defer src.mu.RUnlock()

	return src.active.GetLayer(ctx, spec)
}

func (src *RevisioningLayerSource) Envs(ctx context.Context, spec *api.ImageSpec) ([]EnvModifier, error) {
	src.mu.RLock()
	defer src.mu.RUnlock()

	return src.active.Envs(ctx, spec)
}

// HasBlob checks if a digest can be served by this blob source
func (src *RevisioningLayerSource) HasBlob(ctx context.Context, details *api.ImageSpec, dgst digest.Digest) bool {
	src.mu.RLock()
	defer src.mu.RUnlock()

	if src.active.HasBlob(ctx, details, dgst) {
		return true
	}
	for _, p := range src.past {
		if p.HasBlob(ctx, details, dgst) {
			return true
		}
	}
	return false
}

// GetBlob provides access to a blob. If a ReadCloser is returned the receiver is expected to
// call close on it eventually.
func (src *RevisioningLayerSource) GetBlob(ctx context.Context, details *api.ImageSpec, dgst digest.Digest) (mediaType string, url string, data io.ReadCloser, err error) {
	src.mu.RLock()
	defer src.mu.RUnlock()

	if src.active.HasBlob(ctx, details, dgst) {
		return src.active.GetBlob(ctx, details, dgst)
	}
	for _, p := range src.past {
		if p.HasBlob(ctx, details, dgst) {
			return p.GetBlob(ctx, details, dgst)
		}
	}

	err = errdefs.ErrNotFound
	return
}
