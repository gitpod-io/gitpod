// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/containerd/containerd/content"
	"github.com/containerd/containerd/errdefs"
	"github.com/gitpod-io/gitpod/common-go/log"
	ipfs "github.com/ipfs/boxo/coreiface"
	"github.com/ipfs/boxo/coreiface/options"
	files "github.com/ipfs/boxo/files"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	redis "github.com/redis/go-redis/v9"
	"golang.org/x/xerrors"
)

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
func (store *IPFSBlobCache) Store(ctx context.Context, dgst digest.Digest, content io.Reader, mediaType string) (err error) {
	if store == nil || store.IPFS == nil || store.Redis == nil {
		return nil
	}

	opts := []options.UnixfsAddOption{
		options.Unixfs.Pin(true),
		options.Unixfs.CidVersion(1),
		options.Unixfs.RawLeaves(true),
		options.Unixfs.FsCache(true),
	}

	p, err := store.IPFS.Unixfs().Add(ctx, files.NewReaderFile(content), opts...)
	if err != nil {
		return err
	}

	res := store.Redis.MSet(ctx,
		dgst.String(), p.Cid().String(),
		mediaTypeKeyFromDigest(dgst), mediaType,
	)
	if err := res.Err(); err != nil {
		return err
	}

	log.WithField("digest", dgst.String()).WithField("cid", p.Cid().String()).Debug("pushed to IPFS")

	return nil
}

type RedisBlobStore struct {
	Client *redis.Client
}

var _ BlobStore = &RedisBlobStore{}

// Info will return metadata about content available in the content store.
//
// If the content is not present, ErrNotFound will be returned.
func (rbs *RedisBlobStore) Info(ctx context.Context, dgst digest.Digest) (content.Info, error) {
	res, err := rbs.Client.Get(ctx, "nfo."+string(dgst)).Result()
	if err == redis.Nil {
		return content.Info{}, errdefs.ErrNotFound
	}

	var redisInfo redisBlobInfo
	err = json.Unmarshal([]byte(res), &redisInfo)
	if err != nil {
		return content.Info{}, xerrors.Errorf("cannot unmarshal blob info: %w", err)
	}

	return content.Info{
		Digest:    digest.Digest(redisInfo.Digest),
		Size:      redisInfo.Size,
		CreatedAt: time.Unix(redisInfo.CreatedAt, 0),
		UpdatedAt: time.Unix(redisInfo.UpdatedAt, 0),
		Labels:    redisInfo.Labels,
	}, nil
}

func (rbs *RedisBlobStore) ReaderAt(ctx context.Context, desc ociv1.Descriptor) (content.ReaderAt, error) {
	res, err := rbs.Client.Get(ctx, "cnt."+string(desc.Digest)).Result()
	if err == redis.Nil {
		return nil, errdefs.ErrNotFound
	}

	return stringReader(res), nil
}

type stringReader string

var _ content.ReaderAt = stringReader("")

func (r stringReader) Size() int64  { return int64(len(r)) }
func (r stringReader) Close() error { return nil }
func (r stringReader) ReadAt(p []byte, off int64) (n int, err error) {
	n = copy(p, r[off:])
	if n < len(p) {
		return n, io.EOF
	}
	return
}

// Some implementations require WithRef to be included in opts.
func (rbs *RedisBlobStore) Writer(ctx context.Context, opts ...content.WriterOpt) (content.Writer, error) {
	var wOpts content.WriterOpts
	for _, opt := range opts {
		if err := opt(&wOpts); err != nil {
			return nil, err
		}
	}
	if wOpts.Desc.Digest == "" {
		return nil, xerrors.Errorf("desc.digest must not be empty: %w", errdefs.ErrInvalidArgument)
	}

	return newRedisBlobWriter(wOpts.Desc.Digest, rbs.Client), nil
}

type redisBlobWriter struct {
	buf    *bytes.Buffer
	digest digest.Digest
	client *redis.Client

	forTestingOnlyTime time.Time
}

func newRedisBlobWriter(digest digest.Digest, client *redis.Client) *redisBlobWriter {
	return &redisBlobWriter{
		buf:    bytes.NewBuffer(make([]byte, 0, 4096)),
		digest: digest,
		client: client,
	}
}

var _ content.Writer = &redisBlobWriter{}

func (w *redisBlobWriter) Write(b []byte) (n int, err error) {
	return w.buf.Write(b)
}

func (w *redisBlobWriter) Close() error {
	return nil
}

// Digest may return empty digest or panics until committed.
func (w *redisBlobWriter) Digest() digest.Digest {
	return w.digest
}

type redisBlobInfo struct {
	Digest    string
	Size      int64
	CreatedAt int64
	UpdatedAt int64
	Labels    map[string]string
}

// Commit commits the blob (but no roll-back is guaranteed on an error).
// size and expected can be zero-value when unknown.
// Commit always closes the writer, even on error.
// ErrAlreadyExists aborts the writer.
func (w *redisBlobWriter) Commit(ctx context.Context, size int64, expected digest.Digest, opts ...content.Opt) error {
	act := digest.FromBytes(w.buf.Bytes())
	if expected != "" && expected != act {
		return fmt.Errorf("unexpected commit digest %s, expected %s: %w", act, expected, errdefs.ErrFailedPrecondition)
	}

	var base content.Info
	for _, opt := range opts {
		if err := opt(&base); err != nil {
			return err
		}
	}

	var (
		createdAt int64
		updatedAt int64
	)
	if !w.forTestingOnlyTime.IsZero() {
		createdAt = w.forTestingOnlyTime.Unix()
		updatedAt = w.forTestingOnlyTime.Unix()
	} else {
		createdAt = time.Now().Unix()
		updatedAt = time.Now().Unix()
	}

	rnfo, err := json.Marshal(redisBlobInfo{
		Digest:    string(expected),
		Size:      int64(w.buf.Len()),
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
		Labels:    base.Labels,
	})
	if err != nil {
		return err
	}

	var (
		kContent = fmt.Sprintf("cnt.%s", w.digest)
		kInfo    = fmt.Sprintf("nfo.%s", w.digest)
	)

	existingKeys, err := w.client.Exists(ctx, kContent, kInfo).Result()
	if err != nil {
		return err
	}

	if existingKeys != 0 {
		return nil
	}

	err = w.client.MSet(ctx, map[string]interface{}{
		kContent: w.buf.String(),
		kInfo:    string(rnfo),
	}).Err()
	if err != nil {
		return err
	}

	return nil
}

// Status returns the current state of write
func (w *redisBlobWriter) Status() (content.Status, error) {
	return content.Status{}, fmt.Errorf("not implemented")
}

// Truncate updates the size of the target blob
func (w *redisBlobWriter) Truncate(size int64) error {
	return fmt.Errorf("not implemented")
}
