// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resolve

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/containerd/containerd/remotes"
	dockerremote "github.com/containerd/containerd/remotes/docker"
	"github.com/docker/distribution/reference"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/image-builder/pkg/auth"
)

// ErrNotFound is returned when the reference was not found
var ErrNotFound = xerrors.Errorf("not found")

// StandaloneRefResolver can resolve image references without a Docker daemon
type StandaloneRefResolver struct {
	ResolverFactory func() remotes.Resolver
}

// Resolve resolves a mutable Docker tag to its absolute digest form by asking the corresponding Docker registry
func (sr *StandaloneRefResolver) Resolve(ctx context.Context, ref string, opts ...DockerRefResolverOption) (res string, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "StandaloneRefResolver.Resolve")
	defer func() {
		var rerr error
		if err != ErrNotFound {
			rerr = err
		}
		tracing.FinishSpan(span, &rerr)
	}()

	options := getOptions(opts)

	var r remotes.Resolver
	if sr.ResolverFactory == nil {
		r = dockerremote.NewResolver(dockerremote.ResolverOptions{
			Authorizer: dockerremote.NewDockerAuthorizer(dockerremote.WithAuthCreds(func(host string) (username, password string, err error) {
				if options.Auth == nil {
					return
				}

				return options.Auth.Username, options.Auth.Password, nil
			})),
		})
	} else {
		r = sr.ResolverFactory()
	}

	// The ref may be what Docker calls a "familiar" name, e.g. ubuntu:latest instead of docker.io/library/ubuntu:latest.
	// To make this a valid digested form we first need to normalize that familiar name.
	pref, err := reference.ParseNormalizedNamed(ref)
	if err != nil {
		return "", xerrors.Errorf("cannt resolve image ref: %w", err)
	}

	// The reference is already in digest form we don't have to do anything
	if _, ok := pref.(reference.Canonical); ok {
		span.LogKV("result", ref)
		return ref, nil
	}

	// Some users don't specify a tag, and Docker assumes "latest" - we follow the same convention
	if _, ok := pref.(reference.Tagged); !ok {
		pref, err = reference.WithTag(pref, "latest")
		if err != nil {
			return "", err
		}
	}

	nref := pref.String()
	span.LogKV("normalized-ref", nref)

	res, _, err = r.Resolve(ctx, nref)
	if err != nil && strings.Contains(err.Error(), "not found") {
		err = ErrNotFound
	}

	return
}

type opts struct {
	Auth *auth.Authentication
}

// DockerRefResolverOption configures reference resolution
type DockerRefResolverOption func(o *opts)

// WithAuthentication sets a base64 encoded authentication for accessing a Docker registry
func WithAuthentication(auth *auth.Authentication) DockerRefResolverOption {
	return func(o *opts) {
		o.Auth = auth
	}
}

func getOptions(o []DockerRefResolverOption) *opts {
	var res opts
	for _, opt := range o {
		opt(&res)
	}
	return &res
}

// DockerRefResolver resolves a mutable Docker tag to its absolute digest form.
// For example: gitpod/workspace-full:latest becomes docker.io/gitpod/workspace-full@sha256:sha-hash-goes-here
type DockerRefResolver interface {
	// Resolve resolves a mutable Docker tag to its absolute digest form.
	Resolve(ctx context.Context, ref string, opts ...DockerRefResolverOption) (res string, err error)
}

// PrecachingRefResolver regularly resolves a set of references and returns the cached value when asked to resolve that reference.
type PrecachingRefResolver struct {
	Resolver   DockerRefResolver
	Candidates []string

	mu    sync.RWMutex
	cache map[string]string
}

var _ DockerRefResolver = &PrecachingRefResolver{}

// StartCaching starts the precaching of resolved references at the given interval. This function blocks until the context is canceled
// and is intended to run as a Go routine.
func (pr *PrecachingRefResolver) StartCaching(ctx context.Context, interval time.Duration) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "PrecachingRefResolver.StartCaching")
	defer tracing.FinishSpan(span, nil)

	t := time.NewTicker(interval)

	log.WithField("interval", interval.String()).WithField("refs", pr.Candidates).Info("starting Docker ref pre-cache")

	pr.cache = make(map[string]string)
	for {
		for _, c := range pr.Candidates {
			res, err := pr.Resolver.Resolve(ctx, c)
			if err != nil {
				log.WithError(err).WithField("ref", c).Warn("unable to precache reference")
				continue
			}

			pr.mu.Lock()
			pr.cache[c] = res
			pr.mu.Unlock()

			log.WithField("ref", c).WithField("resolved-to", res).Debug("pre-cached Docker ref")
		}

		select {
		case <-t.C:
		case <-ctx.Done():
			log.Debug("context cancelled - shutting down Docker ref pre-caching")
			return
		}
	}
}

// Resolve aims to resolve a ref using its own cache first and asks the underlying resolver otherwise
func (pr *PrecachingRefResolver) Resolve(ctx context.Context, ref string, opts ...DockerRefResolverOption) (res string, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "PrecachingRefResolver.Resolve")
	defer tracing.FinishSpan(span, &err)

	pr.mu.RLock()
	defer pr.mu.RUnlock()

	if pr.cache == nil {
		return pr.Resolver.Resolve(ctx, ref, opts...)
	}

	res, ok := pr.cache[ref]
	if !ok {
		return pr.Resolver.Resolve(ctx, ref, opts...)
	}

	return res, nil
}
