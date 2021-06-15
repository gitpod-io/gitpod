// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/opencontainers/go-digest"
)

// RoundTripFunc .
type RoundTripFunc func(req *http.Request) *http.Response

// RoundTrip .
func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

func TestFileDownloadInitializer(t *testing.T) {
	const defaultContent = "hello world"

	type serverSideFile struct {
		Path    string
		Content string
	}
	tests := []struct {
		Name          string
		Files         []fileInfo
		ServerSide    []serverSideFile
		ExpectedError string
	}{
		{
			Name: "happy path",
			Files: []fileInfo{
				{
					URL:    "/file1",
					Path:   "/level/file1",
					Digest: digest.FromString(defaultContent),
				},
				// duplication is intentional
				{
					URL:    "/file1",
					Path:   "/level/file1",
					Digest: digest.FromString(defaultContent),
				},
				{
					URL:    "/file2",
					Path:   "/level/file2",
					Digest: digest.FromString(defaultContent),
				},
			},
			ServerSide: []serverSideFile{
				{Path: "/file1", Content: defaultContent},
				{Path: "/file2", Content: defaultContent},
			},
		},
		{
			Name: "digest mismatch",
			Files: []fileInfo{
				{
					URL:    "/file1",
					Path:   "/level/file1",
					Digest: digest.FromString(defaultContent + "foobar"),
				},
			},
			ServerSide: []serverSideFile{
				{Path: "/file1", Content: defaultContent},
			},
			ExpectedError: "digest mismatch",
		},
		{
			Name: "file not found",
			Files: []fileInfo{
				{
					URL:    "/file1",
					Path:   "/level/file1",
					Digest: digest.FromString(defaultContent + "foobar"),
				},
			},
			ExpectedError: "non-OK download response: Not Found",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			tmpdir, err := os.MkdirTemp("", "TestFileDownloadInitializer*")
			if err != nil {
				t.Fatal("cannot create tempdir", err)
			}
			defer os.RemoveAll(tmpdir)

			client := &http.Client{
				Transport: RoundTripFunc(func(req *http.Request) *http.Response {
					for _, f := range test.ServerSide {
						if f.Path != req.URL.Path {
							continue
						}

						return &http.Response{
							StatusCode: http.StatusOK,
							Body:       io.NopCloser(bytes.NewReader([]byte(f.Content))),
							Header:     make(http.Header),
						}
					}

					return &http.Response{
						Status:     http.StatusText(http.StatusNotFound),
						StatusCode: http.StatusNotFound,
						Header:     make(http.Header),
					}
				}),
			}

			req := &api.FileDownloadInitializer{}
			for _, f := range test.Files {
				req.Files = append(req.Files, &api.FileDownloadInitializer_FileInfo{
					Url:      "http://foobar" + f.URL,
					FilePath: f.Path,
					Digest:   string(f.Digest),
				})
			}

			initializer, err := newFileDownloadInitializer(tmpdir, req)
			if err != nil {
				t.Fatal(err)
			}
			initializer.HTTPClient = client
			initializer.RetryTimeout = 0

			src, err := initializer.Run(context.Background(), nil)
			if err == nil && src != api.WorkspaceInitFromOther {
				t.Error("initializer returned wrong content init source")
			}
			if err != nil && err.Error() != test.ExpectedError {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
