// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registry

import (
	"context"
	"encoding/json"

	"github.com/containerd/containerd/remotes"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	redis "github.com/redis/go-redis/v9"
)

type RedisCachedResolver struct {
	Client   *redis.Client
	Provider ResolverProvider

	d remotes.Resolver
}

var (
	_ remotes.Resolver = &RedisCachedResolver{}
	_ ResolverProvider = (&RedisCachedResolver{}).Factory
)

type resolverResult struct {
	Name string
	Desc ociv1.Descriptor
}

// Resolve attempts to resolve the reference into a name and descriptor.
//
// The argument `ref` should be a scheme-less URI representing the remote.
// Structurally, it has a host and path. The "host" can be used to directly
// reference a specific host or be matched against a specific handler.
//
// The returned name should be used to identify the referenced entity.
// Dependending on the remote namespace, this may be immutable or mutable.
// While the name may differ from ref, it should itself be a valid ref.
//
// If the resolution fails, an error will be returned.
func (rcr *RedisCachedResolver) Resolve(ctx context.Context, ref string) (name string, desc ociv1.Descriptor, err error) {
	raw, _ := rcr.Client.Get(ctx, "resolve."+ref).Result()
	if raw != "" {
		var res resolverResult
		if err := json.Unmarshal([]byte(raw), &res); err == nil {
			return res.Name, res.Desc, nil
		}
	}

	name, desc, err = rcr.resolver().Resolve(ctx, ref)
	if err != nil {
		return
	}

	if raw, err := json.Marshal(resolverResult{Name: name, Desc: desc}); err == nil {
		rcr.Client.Set(ctx, "resolve."+ref, string(raw), 0)
	}

	return
}

// Fetcher returns a new fetcher for the provided reference.
// All content fetched from the returned fetcher will be
// from the namespace referred to by ref.
func (rcr *RedisCachedResolver) Fetcher(ctx context.Context, ref string) (remotes.Fetcher, error) {
	return rcr.resolver().Fetcher(ctx, ref)
}

// Pusher returns a new pusher for the provided reference
// The returned Pusher should satisfy content.Ingester and concurrent attempts
// to push the same blob using the Ingester API should result in ErrUnavailable.
func (rcr *RedisCachedResolver) Pusher(ctx context.Context, ref string) (remotes.Pusher, error) {
	return rcr.resolver().Pusher(ctx, ref)
}

func (rcr *RedisCachedResolver) resolver() remotes.Resolver {
	if rcr.d == nil {
		rcr.d = rcr.Provider()
	}
	return rcr.d
}

func (rcr *RedisCachedResolver) Factory() remotes.Resolver {
	return &RedisCachedResolver{
		Client:   rcr.Client,
		Provider: rcr.Provider,
		d:        rcr.Provider(),
	}
}
