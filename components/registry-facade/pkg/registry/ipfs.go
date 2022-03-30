// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry

import (
	"context"
	"io"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	redis "github.com/go-redis/redis/v8"
	files "github.com/ipfs/go-ipfs-files"
	ipfs "github.com/ipfs/interface-go-ipfs-core"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
)

// ipfsManifestModifier modifies a manifest and adds IPFS URLs to the layers
func (reg *Registry) ipfsManifestModifier(mf *ociv1.Manifest) error {
	if reg.IPFS == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	for i, l := range mf.Layers {
		wg.Add(1)
		go func(i int, dgst digest.Digest) {
			defer wg.Done()

			url, _ := reg.IPFS.Get(ctx, dgst)
			if url == "" {
				return
			}
			mf.Layers[i].URLs = append(mf.Layers[i].URLs, url)
		}(i, l.Digest)
	}
	wg.Wait()

	return nil
}

// IPFSBlobCache can cache blobs in IPFS
type IPFSBlobCache struct {
	Redis *redis.Client
	IPFS  ipfs.CoreAPI
}

// Get retrieves the IPFS URL for a previously stored blob.
// Returns an error if the blob is not stored in IPFS yet.
func (store *IPFSBlobCache) Get(ctx context.Context, dgst digest.Digest) (ipfsURL string, err error) {
	if store == nil || store.IPFS == nil || store.Redis == nil {
		return "", nil
	}

	res, err := store.Redis.Get(ctx, dgst.String()).Result()
	if err != nil {
		return "", err
	}

	return "ipfs://" + res, nil
}

// Store stores a blob in IPFS. Will happily overwrite/re-upload a blob.
func (store *IPFSBlobCache) Store(ctx context.Context, dgst digest.Digest, content io.Reader) (err error) {
	if store == nil || store.IPFS == nil || store.Redis == nil {
		return nil
	}

	p, err := store.IPFS.Unixfs().Add(ctx, files.NewReaderFile(content), options.Unixfs.Pin(true), options.Unixfs.CidVersion(1))
	if err != nil {
		return err
	}

	res := store.Redis.Set(ctx, dgst.String(), p.Cid().String(), 0)
	if err := res.Err(); err != nil {
		return err
	}

	log.WithField("digest", dgst.String()).WithField("cid", p.Cid().String()).Debug("pushed to IPFS")

	return nil
}
