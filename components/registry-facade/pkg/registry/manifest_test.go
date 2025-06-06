// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registry

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/containerd/containerd/content"
	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/remotes"
	"github.com/opencontainers/go-digest"
	"github.com/opencontainers/image-spec/specs-go"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"
)

func TestDownloadManifest(t *testing.T) {
	tests := []struct {
		Name    string
		Store   BlobStore
		FetchMF bool
	}{
		{
			Name: "no store",
		},
		{
			Name:  "accepts nothing store",
			Store: &alwaysNotFoundStore{},
		},
		{
			Name:  "misbehaving store",
			Store: &misbehavingStore{},
		},
		{
			Name:    "fetch mf no store",
			FetchMF: true,
		},
		{
			Name:    "fetch mf with store",
			Store:   &alwaysNotFoundStore{},
			FetchMF: true,
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			cfg, err := json.Marshal(ociv1.ImageConfig{})
			if err != nil {
				t.Fatal(err)
			}
			cfgDgst := digest.FromBytes(cfg)

			mf, err := json.Marshal(ociv1.Manifest{
				Versioned: specs.Versioned{SchemaVersion: 1},
				MediaType: ociv1.MediaTypeImageManifest,
				Config: ociv1.Descriptor{
					MediaType: ociv1.MediaTypeImageConfig,
					Digest:    cfgDgst,
					Size:      int64(len(cfg)),
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			mfDgst := digest.FromBytes(mf)
			mfDesc := ociv1.Descriptor{
				MediaType: ociv1.MediaTypeImageManifest,
				Digest:    mfDgst,
				Size:      int64(len(mf)),
			}

			mfl, err := json.Marshal(ociv1.Index{
				MediaType: ociv1.MediaTypeImageIndex,
				Manifests: []ociv1.Descriptor{mfDesc},
			})
			if err != nil {
				t.Fatal(err)
			}
			mflDgst := digest.FromBytes(mfl)
			mflDesc := ociv1.Descriptor{
				MediaType: ociv1.MediaTypeImageIndex,
				Digest:    mflDgst,
				Size:      int64(len(mfl)),
			}

			fetcher := AsFetcherFunc(&fakeFetcher{
				Content: map[string][]byte{
					mflDgst.Encoded(): mfl,
					mfDgst.Encoded():  mf,
					cfgDgst.Encoded(): cfg,
				},
			})
			desc := mflDesc
			if test.FetchMF {
				desc = mfDesc
			}
			_, _, err = DownloadManifest(context.Background(), fetcher, desc, WithStore(test.Store))
			if err != nil {
				t.Fatal(err)
			}
		})
	}
}

type alwaysNotFoundStore struct{}

func (fbs *alwaysNotFoundStore) ReaderAt(ctx context.Context, desc ociv1.Descriptor) (content.ReaderAt, error) {
	return nil, errdefs.ErrNotFound
}

// Some implementations require WithRef to be included in opts.
func (fbs *alwaysNotFoundStore) Writer(ctx context.Context, opts ...content.WriterOpt) (content.Writer, error) {
	return nil, errdefs.ErrAlreadyExists
}

// Info will return metadata about content available in the content store.
//
// If the content is not present, ErrNotFound will be returned.
func (fbs *alwaysNotFoundStore) Info(ctx context.Context, dgst digest.Digest) (content.Info, error) {
	return content.Info{}, errdefs.ErrNotFound
}

type misbehavingStore struct{}

func (fbs *misbehavingStore) ReaderAt(ctx context.Context, desc ociv1.Descriptor) (content.ReaderAt, error) {
	return nil, fmt.Errorf("foobar")
}

// Some implementations require WithRef to be included in opts.
func (fbs *misbehavingStore) Writer(ctx context.Context, opts ...content.WriterOpt) (content.Writer, error) {
	return nil, fmt.Errorf("some error")
}

// Info will return metadata about content available in the content store.
//
// If the content is not present, ErrNotFound will be returned.
func (fbs *misbehavingStore) Info(ctx context.Context, dgst digest.Digest) (content.Info, error) {
	return content.Info{}, fmt.Errorf("you wish")
}

// manifestFailingReader is a reader that fails after a certain point.
type manifestFailingReader struct {
	reader         io.Reader
	failAfterBytes int
	failError      error
	bytesRead      int
}

func (fr *manifestFailingReader) Read(p []byte) (n int, err error) {
	if fr.bytesRead >= fr.failAfterBytes {
		return 0, fr.failError
	}
	n, err = fr.reader.Read(p)
	if err != nil {
		return n, err
	}
	fr.bytesRead += n
	if fr.bytesRead >= fr.failAfterBytes {
		// Return the error, but also the bytes read in this call.
		return n, fr.failError
	}
	return n, nil
}

func (fr *manifestFailingReader) Close() error {
	return nil
}

type mockFetcher struct {
	// How many times Fetch should fail before succeeding.
	failCount int
	// The error to return on failure.
	failError error

	// Internal counter for calls.
	callCount int
	// The data to return on success.
	successData string

	// Whether to use a reader that fails mid-stream on the first call.
	failReaderOnFirstCall bool
	// The number of bytes to read successfully before the reader fails.
	failAfterBytes int
}

func (m *mockFetcher) Fetch(ctx context.Context, desc ociv1.Descriptor) (io.ReadCloser, error) {
	m.callCount++
	if m.callCount <= m.failCount {
		return nil, m.failError
	}

	if m.failReaderOnFirstCall && m.callCount == 1 {
		return &manifestFailingReader{
			reader:         strings.NewReader(m.successData),
			failAfterBytes: m.failAfterBytes,
			failError:      m.failError,
		}, nil
	}

	return io.NopCloser(strings.NewReader(m.successData)), nil
}

func TestDownloadManifest_RetryOnReadAll(t *testing.T) {
	// Arrange
	mockFetcher := &mockFetcher{
		failCount:             0, // Fetch succeeds immediately
		failReaderOnFirstCall: true,
		failAfterBytes:        5,
		failError:             syscall.EPIPE,
		successData:           `{"schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json"}`,
	}

	fetcherFunc := func() (remotes.Fetcher, error) {
		return mockFetcher, nil
	}

	// Use short backoff for testing
	originalBackoff := fetcherBackoffParams
	fetcherBackoffParams = wait.Backoff{
		Duration: 1 * time.Millisecond,
		Steps:    3,
	}
	defer func() { fetcherBackoffParams = originalBackoff }()

	// Act
	_, _, err := DownloadManifest(context.Background(), fetcherFunc, ociv1.Descriptor{MediaType: ociv1.MediaTypeImageManifest})

	// Assert
	require.NoError(t, err)
	assert.Equal(t, 2, mockFetcher.callCount, "Expected Fetch to be called twice (1st succeeds, read fails, 2nd succeeds)")
}

func TestDownloadConfig_RetryOnReadAll(t *testing.T) {
	// Arrange
	mockFetcher := &mockFetcher{
		failCount:             0, // Fetch succeeds immediately
		failReaderOnFirstCall: true,
		failAfterBytes:        5,
		failError:             syscall.EPIPE,
		successData:           `{"architecture": "amd64", "os": "linux"}`,
	}

	fetcherFunc := func() (remotes.Fetcher, error) {
		return mockFetcher, nil
	}

	// Use short backoff for testing
	originalBackoff := fetcherBackoffParams
	fetcherBackoffParams = wait.Backoff{
		Duration: 1 * time.Millisecond,
		Steps:    3,
	}
	defer func() { fetcherBackoffParams = originalBackoff }()

	// Act
	_, err := DownloadConfig(context.Background(), fetcherFunc, "ref", ociv1.Descriptor{MediaType: ociv1.MediaTypeImageConfig})

	// Assert
	require.NoError(t, err)
	assert.Equal(t, 2, mockFetcher.callCount, "Expected Fetch to be called twice (1st succeeds, read fails, 2nd succeeds)")
}

func TestDownloadManifest_RetryOnFetch(t *testing.T) {
	// Arrange
	mockFetcher := &mockFetcher{
		failCount:   2,
		failError:   errors.New("transient network error"),
		successData: `{"schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json"}`,
	}

	fetcherFunc := func() (remotes.Fetcher, error) {
		return mockFetcher, nil
	}

	// Use short backoff for testing
	originalBackoff := fetcherBackoffParams
	fetcherBackoffParams = wait.Backoff{
		Duration: 1 * time.Millisecond,
		Steps:    3,
	}
	defer func() { fetcherBackoffParams = originalBackoff }()

	// Act
	_, _, err := DownloadManifest(context.Background(), fetcherFunc, ociv1.Descriptor{MediaType: ociv1.MediaTypeImageManifest})

	// Assert
	require.NoError(t, err)
	assert.Equal(t, 3, mockFetcher.callCount, "Expected Fetch to be called 3 times (2 failures + 1 success)")
}
