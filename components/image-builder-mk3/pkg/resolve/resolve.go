// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package resolve

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/containerd/containerd/remotes"
	dockerremote "github.com/containerd/containerd/remotes/docker"
	"github.com/docker/distribution/reference"
	"github.com/opencontainers/go-digest"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/image-builder/pkg/auth"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
)

var (
	// ErrNotFound is returned when the reference was not found
	ErrNotFound = xerrors.Errorf("not found")

	// ErrNotFound is returned when we're not authorized to return the reference
	ErrUnauthorized = xerrors.Errorf("not authorized")
)

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

	nref := pref.String()
	pref = reference.TrimNamed(pref)
	span.LogKV("normalized-ref", nref)

	res, desc, err := r.Resolve(ctx, nref)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			err = ErrNotFound
		} else if strings.Contains(err.Error(), "Unauthorized") {
			err = ErrUnauthorized
		}
		return
	}

	fetcher, err := r.Fetcher(ctx, res)
	if err != nil {
		return
	}

	in, err := fetcher.Fetch(ctx, desc)
	if err != nil {
		return
	}
	defer in.Close()
	buf, err := ioutil.ReadAll(in)
	if err != nil {
		return
	}

	var mf ociv1.Manifest
	err = json.Unmarshal(buf, &mf)
	if err != nil {
		return "", fmt.Errorf("cannot unmarshal manifest: %w", err)
	}

	if mf.Config.Size != 0 {
		pref, err = reference.WithDigest(pref, desc.Digest)
		if err != nil {
			return
		}
		return pref.String(), nil
	}

	var mfl ociv1.Index
	err = json.Unmarshal(buf, &mfl)
	if err != nil {
		return
	}

	var dgst digest.Digest
	for _, mf := range mfl.Manifests {
		if mf.Platform == nil {
			continue
		}
		if fmt.Sprintf("%s-%s", mf.Platform.OS, mf.Platform.Architecture) == "linux-amd64" {
			dgst = mf.Digest
			break
		}
	}
	if dgst == "" {
		return "", fmt.Errorf("no manifest for platform linux-amd64 found")
	}

	pref, err = reference.WithDigest(pref, dgst)
	if err != nil {
		return
	}
	return pref.String(), nil
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

type MockRefResolver map[string]string

func (m MockRefResolver) Resolve(ctx context.Context, ref string, opts ...DockerRefResolverOption) (res string, err error) {
	res, ok := m[ref]
	if !ok {
		return "", ErrNotFound
	}
	return res, nil
}
