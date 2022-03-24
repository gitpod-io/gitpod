package registry

import (
	"context"
	"io"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	redis "github.com/go-redis/redis/v8"
	files "github.com/ipfs/go-ipfs-files"
	ipfs "github.com/ipfs/interface-go-ipfs-core"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
)

func (reg *Registry) ipfsManifestModifier(mf *ociv1.Manifest) error {
	if reg.IPFS == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for i, l := range mf.Layers {
		url, _ := reg.IPFS.Get(ctx, l.Digest)
		if url == "" {
			continue
		}
		mf.Layers[i].URLs = append(mf.Layers[i].URLs, url)
	}

	return nil
}

type IPFSStore struct {
	Redis *redis.Client
	IPFS  ipfs.CoreAPI
}

func (store *IPFSStore) Get(ctx context.Context, dgst digest.Digest) (ipfsURL string, err error) {
	res, err := store.Redis.Get(ctx, dgst.String()).Result()
	if err != nil {
		return "", err
	}

	return "ipfs://" + res, nil
}

func (store *IPFSStore) Has(ctx context.Context, dgst digest.Digest) (ok bool, err error) {
	res := store.Redis.Exists(ctx, dgst.String())
	if err := res.Err(); err != nil {
		return false, err
	}

	return res.Val() == 1, nil
}

func (store *IPFSStore) Store(ctx context.Context, dgst digest.Digest, content io.Reader) (err error) {
	p, err := store.IPFS.Unixfs().Add(ctx, files.NewReaderFile(content), options.Unixfs.Pin(true), options.Unixfs.CidVersion(1))
	if err != nil {
		return err
	}

	res := store.Redis.Set(ctx, dgst.String(), p.Cid().String(), 36*time.Hour)
	if err := res.Err(); err != nil {
		return err
	}

	log.WithField("digest", dgst.String()).WithField("cid", p.Cid().String()).Debug("pushed to IPFS")

	return nil
}
