// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	content_service_api "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

var (
	gitpodBuiltinUserID = "00000000-0000-0000-0000-000000000000"
)

func hasErrorCode(err error, code codes.Code) bool {
	st, ok := status.FromError(err)
	return ok && st.Code() == code
}

func TestUploadUrl(t *testing.T) {
	tests := []struct {
		Name              string
		InputOwnerID      string
		InputName         string
		ExpectedErrorCode codes.Code
	}{
		{
			Name:         "simple name",
			InputOwnerID: gitpodBuiltinUserID,
			InputName:    "test-blob",
		},
		{
			Name:         "new user",
			InputOwnerID: "new-user",
			InputName:    "test-blob",
		},
		{
			Name:              "name with whitespace",
			InputOwnerID:      gitpodBuiltinUserID,
			InputName:         "whitespaces are not allowed",
			ExpectedErrorCode: codes.InvalidArgument,
		},
		{
			Name:              "name with invalid char",
			InputOwnerID:      gitpodBuiltinUserID,
			InputName:         "ä-is-not-allowed",
			ExpectedErrorCode: codes.InvalidArgument,
		},
	}

	f := features.New("UploadUrlRequest").
		WithLabel("component", "content-service").
		Assess("it should run content-service tests", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			bs, err := api.BlobService()
			if err != nil {
				t.Fatal(err)
			}

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
					resp, err := bs.UploadUrl(ctx, &content_service_api.UploadUrlRequest{OwnerId: test.InputOwnerID, Name: test.InputName})
					if err != nil && test.ExpectedErrorCode == codes.OK {
						t.Fatal(err)
					}
					if err == nil && test.ExpectedErrorCode != codes.OK {
						t.Fatalf("expected error with error code '%v' but got no error at all", test.ExpectedErrorCode)
					}
					if !hasErrorCode(err, test.ExpectedErrorCode) {
						t.Fatalf("expected error with error code '%v' but got error %v", test.ExpectedErrorCode, err)
					}
					if err != nil && test.ExpectedErrorCode == codes.OK {
						url := resp.Url
						if url == "" {
							t.Fatal("upload url is empty")
						}
						t.Logf("Got URL repsonse: %s", url)
					}
				})
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

func TestDownloadUrl(t *testing.T) {
	tests := []struct {
		Name              string
		InputOwnerID      string
		InputName         string
		ExpectedErrorCode codes.Code
	}{
		{
			Name:              "not existing download",
			InputOwnerID:      gitpodBuiltinUserID,
			InputName:         "this-does-not-exist",
			ExpectedErrorCode: codes.NotFound,
		},
	}

	f := features.New("DownloadUrl").
		WithLabel("component", "server").
		Assess("it should pass download URL tests", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			bs, err := api.BlobService()
			if err != nil {
				t.Fatal(err)
			}

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
					resp, err := bs.DownloadUrl(ctx, &content_service_api.DownloadUrlRequest{OwnerId: test.InputOwnerID, Name: test.InputName})
					if err != nil && test.ExpectedErrorCode == codes.OK {
						t.Fatal(err)
					}
					if err == nil && test.ExpectedErrorCode != codes.OK {
						t.Fatalf("expected error with error code '%v' but got no error at all", test.ExpectedErrorCode)
					}
					if !hasErrorCode(err, test.ExpectedErrorCode) {
						t.Fatalf("expected error with error code '%v' but got error %v", test.ExpectedErrorCode, err)
					}
					if err != nil && test.ExpectedErrorCode == codes.OK {
						url := resp.Url
						if url == "" {
							t.Fatal("download url is empty")
						}
						t.Logf("Got URL repsonse: %s", url)
					}
				})
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

func TestUploadDownloadBlob(t *testing.T) {
	f := features.New("UploadDownloadBlob").
		WithLabel("component", "server").
		Assess("it should upload and download blob", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			blobContent := fmt.Sprintf("Hello Blobs! It's %s!", time.Now())

			bs, err := api.BlobService()
			if err != nil {
				t.Fatal(err)
			}

			resp, err := bs.UploadUrl(ctx, &content_service_api.UploadUrlRequest{OwnerId: gitpodBuiltinUserID, Name: "test-blob"})
			if err != nil {
				t.Fatal(err)
			}
			url := resp.Url
			t.Logf("upload URL: %s", url)

			uploadBlob(t, url, blobContent)

			resp2, err := bs.DownloadUrl(ctx, &content_service_api.DownloadUrlRequest{OwnerId: gitpodBuiltinUserID, Name: "test-blob"})
			if err != nil {
				t.Fatal(err)
			}
			url = resp2.Url
			t.Logf("download URL: %s", url)

			body := downloadBlob(t, url)
			if string(body) != blobContent {
				t.Fatalf("blob content mismatch: should '%s' but is '%s'", blobContent, body)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

// TestUploadDownloadBlobViaServer uploads a blob via server → content-server and downloads it afterwards
func TestUploadDownloadBlobViaServer(t *testing.T) {
	integration.SkipWithoutUsername(t, username)

	f := features.New("UploadDownloadBlobViaServer").
		WithLabel("component", "content-server").
		Assess("it should uploads a blob via server → content-server and downloads it afterwards", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			blobContent := fmt.Sprintf("Hello Blobs! It's %s!", time.Now())

			server, err := api.GitpodServer()
			if err != nil {
				t.Fatalf("cannot get content blob upload URL: %q", err)
			}

			url, err := server.GetContentBlobUploadURL(ctx, "test-blob")
			if err != nil {
				t.Fatalf("cannot get content blob upload URL: %q", err)
			}
			t.Logf("upload URL: %s", url)

			uploadBlob(t, url, blobContent)

			url, err = server.GetContentBlobDownloadURL(ctx, "test-blob")
			if err != nil {
				t.Fatalf("cannot get content blob download URL: %q", err)
			}
			t.Logf("download URL: %s", url)

			body := downloadBlob(t, url)
			if string(body) != blobContent {
				t.Fatalf("blob content mismatch: should '%s' but is '%s'", blobContent, body)
			}

			t.Log("Uploading and downloading blob to content store succeeded.")

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

func uploadBlob(t *testing.T, url string, content string) {
	var client = &http.Client{Timeout: time.Second * 10}
	httpreq, err := http.NewRequest(http.MethodPut, url, strings.NewReader(content))
	if err != nil {
		t.Fatalf("cannot create HTTP PUT request: %q", err)
	}
	httpresp, err := client.Do(httpreq)
	if err != nil {
		t.Fatalf("HTTP PUT request failed: %q", err)
	}
	body, err := io.ReadAll(httpresp.Body)
	if err != nil {
		t.Fatalf("cannot read response body of HTTP PUT: %q", err)
	}
	if string(body) != "" {
		t.Fatalf("unexpected response body of HTTP PUT: '%q'", body)
	}
}

func downloadBlob(t *testing.T, url string) string {
	httpresp, err := http.Get(url)
	if err != nil {
		t.Fatalf("HTTP GET requst failed: %q", err)
	}
	body, err := io.ReadAll(httpresp.Body)
	if err != nil {
		t.Fatalf("cannot read response body of HTTP PUT: %q", err)
	}
	return string(body)
}
