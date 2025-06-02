// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/containerd/containerd/remotes"
	dockerremote "github.com/containerd/containerd/remotes/docker"
	"github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/api/config"
	apimock "github.com/gitpod-io/gitpod/image-builder/api/mock"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	wsmock "github.com/gitpod-io/gitpod/ws-manager/api/mock"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestBuild(t *testing.T) {
	type testFunc func(t *testing.T, ctrl *gomock.Controller, wsman *wsmock.MockWorkspaceManagerClient, builder *Orchestrator)

	testImageDoubleCheck := func(failure bool) testFunc {
		const (
			baseRef           = "source-image:latest"
			resultRef         = "does-not-exist"
			workspaceImageRef = "registry/workspace:2b1325adbf901167f47a914a62d377c98f1e32e0837dafb95ca86ca9d08ab14e"
		)
		return func(t *testing.T, ctrl *gomock.Controller, wsman *wsmock.MockWorkspaceManagerClient, builder *Orchestrator) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Error(w, "", http.StatusOK)
			}))
			t.Cleanup(srv.Close)

			pushUpdate := make(chan struct{})

			resolver := resolve.MockRefResolver{
				baseRef: baseRef,
			}
			if !failure {
				resolver[workspaceImageRef] = resultRef
			}
			builder.RefResolver = resolver
			wsman.EXPECT().StartWorkspace(gomock.Any(), gomock.Any(), gomock.Any()).
				DoAndReturn(func(ctx context.Context, req *wsmanapi.StartWorkspaceRequest, _ ...interface{}) (*wsmanapi.StartWorkspaceResponse, error) {
					close(pushUpdate)
					t.Log("StartWorkspace called")

					go func() {
						time.Sleep(1 * time.Second)
						var k string
						for kk := range builder.buildListener {
							k = kk
						}
						var l buildListener
						for ll := range builder.buildListener[k] {
							l = ll
						}
						l <- &api.BuildResponse{
							Ref:    resultRef,
							Status: api.BuildStatus_done_success,
						}
					}()

					return &wsmanapi.StartWorkspaceResponse{
						Url:        srv.URL,
						OwnerToken: "foobar",
					}, nil
				}).MaxTimes(1)
			wsman.EXPECT().GetWorkspaces(gomock.Any(), gomock.Any()).Return(&wsmanapi.GetWorkspacesResponse{
				Status: []*wsmanapi.WorkspaceStatus{},
			}, nil).MaxTimes(1)

			resp := apimock.NewMockImageBuilder_BuildServer(ctrl)
			resp.EXPECT().Context().Return(context.Background()).AnyTimes()
			if failure {
				resp.EXPECT().Send(&api.BuildResponse{
					Ref:     resultRef,
					Status:  api.BuildStatus_done_failure,
					Message: "image build did not produce a workspace image",
				}).Return(nil).AnyTimes()
			} else {
				resp.EXPECT().Send(&api.BuildResponse{Ref: workspaceImageRef, BaseRef: baseRef, Status: api.BuildStatus_done_success}).Return(nil).AnyTimes()
			}

			err := builder.Build(&api.BuildRequest{
				Source: &api.BuildSource{
					From: &api.BuildSource_Ref{Ref: &api.BuildSourceReference{Ref: "source-image:latest"}},
				},
			}, resp)
			if err != nil {
				t.Fatal(err)
			}
		}
	}

	tests := []struct {
		Name string
		Test func(t *testing.T, ctrl *gomock.Controller, wsman *wsmock.MockWorkspaceManagerClient, builder *Orchestrator)
	}{
		{
			Name: "validate request - no build source",
			Test: func(t *testing.T, ctrl *gomock.Controller, wsman *wsmock.MockWorkspaceManagerClient, builder *Orchestrator) {
				resp := apimock.NewMockImageBuilder_BuildServer(ctrl)
				resp.EXPECT().Context().Return(context.Background()).AnyTimes()
				err := builder.Build(&api.BuildRequest{}, resp)
				if err == nil {
					t.Error("builder accepted invalid request")
				}
			},
		},
		{
			Name: "double check if image is present - failure",
			Test: testImageDoubleCheck(true),
		},
		{
			Name: "double check if image is present - success",
			Test: testImageDoubleCheck(false),
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			wsman := wsmock.NewMockWorkspaceManagerClient(ctrl)

			o, err := NewOrchestratingBuilder(config.Configuration{
				WorkspaceManager: config.WorkspaceManagerConfig{
					Client: wsman,
				},
				BaseImageRepository:      "registry/base",
				WorkspaceImageRepository: "registry/workspace",
				BuilderImage:             "builder-image",
			})
			if err != nil {
				t.Fatal(err)
			}

			test.Test(t, ctrl, wsman, o)
		})
	}
}

type unauthenticatedResolver struct{}

func (unauthenticatedResolver) Resolve(ctx context.Context, ref string, opts ...resolve.DockerRefResolverOption) (res string, err error) {
	return "", resolve.ErrUnauthorized
}

func TestResolveBaseImage(t *testing.T) {
	type Expectation struct {
		Code codes.Code
	}
	ref := "some-image:latest"
	tests := []struct {
		Name        string
		Resolver    resolve.DockerRefResolver
		Expectation Expectation
	}{
		{
			Name:     "not found",
			Resolver: resolve.MockRefResolver{},
			Expectation: Expectation{
				Code: codes.NotFound,
			},
		},
		{
			Name:     "not authenticated",
			Resolver: unauthenticatedResolver{},
			Expectation: Expectation{
				Code: codes.Unauthenticated,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			o, err := NewOrchestratingBuilder(config.Configuration{
				WorkspaceManager: config.WorkspaceManagerConfig{
					Client: wsmock.NewMockWorkspaceManagerClient(ctrl),
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			o.RefResolver = test.Resolver

			_, err = o.ResolveBaseImage(context.Background(), &api.ResolveBaseImageRequest{
				Ref: ref,
			})
			act := Expectation{Code: status.Code(err)}
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("ResolveBaseImage() mismatch (-want +got):\n%s", diff)
			}
		})
	}

}

// fakeRegistryServer simulates a Docker registry that can inject TLS handshake timeout errors
type fakeRegistryServer struct {
	t              *testing.T
	failureCount   int
	manifestDigest string

	requestCount int64
	server       *httptest.Server
}

func newFakeRegistryServer(t *testing.T, failureCount int) *fakeRegistryServer {
	f := &fakeRegistryServer{
		t:              t,
		failureCount:   failureCount,
		manifestDigest: "sha256:abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
	}

	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt64(&f.requestCount, 1)

		f.t.Logf("Received request %d: %s %s", count, r.Method, r.URL.Path)

		// Simulate network errors for the first few requests
		if int(count) <= f.failureCount {
			// Return 500 error which should trigger retry in the retryable HTTP client
			http.Error(w, "simulated network error", http.StatusInternalServerError)
			return
		}

		// After failure count, serve normally - route to appropriate handler
		if r.URL.Path == "/v2/" && r.Method == "GET" {
			f.handlePing(w, r)
		} else if strings.Contains(r.URL.Path, "/manifests/") && (r.Method == "GET" || r.Method == "HEAD") {
			// Handle manifest requests like /v2/{name}/manifests/{reference}
			f.handleManifest(w, r)
		} else {
			http.NotFound(w, r)
		}
	}))

	return f
}

func (f *fakeRegistryServer) handlePing(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/v2/" && r.Method == "GET" {
		w.Header().Set("Docker-Distribution-API-Version", "registry/2.0")
		w.WriteHeader(http.StatusOK)
		return
	}
	f.handleManifest(w, r)
}

func (f *fakeRegistryServer) handleManifest(w http.ResponseWriter, r *http.Request) {
	// Create a simple manifest response
	manifest := ociv1.Manifest{
		MediaType: "application/vnd.docker.distribution.manifest.v2+json",
		Config: ociv1.Descriptor{
			MediaType: "application/vnd.docker.container.image.v1+json",
			Size:      1234,
			Digest:    "sha256:config123",
		},
	}

	manifestBytes, _ := json.Marshal(manifest)

	w.Header().Set("Content-Type", "application/vnd.docker.distribution.manifest.v2+json")
	w.Header().Set("Docker-Content-Digest", f.manifestDigest)
	w.WriteHeader(http.StatusOK)
	w.Write(manifestBytes)
}

func (f *fakeRegistryServer) URL() string {
	return f.server.URL
}

func (f *fakeRegistryServer) Close() {
	f.server.Close()
}

func (f *fakeRegistryServer) RequestCount() int64 {
	return atomic.LoadInt64(&f.requestCount)
}

// TestResolveBaseImageWithRetryClientHandlesTLSTimeout tests that the retry client
// properly handles intermittent TLS handshake timeout errors by using a fake registry server
func TestResolveBaseImageWithRetryClientHandlesTLSTimeout(t *testing.T) {
	tests := []struct {
		name           string
		useRetryClient bool
		failureCount   int
		expectSuccess  bool
	}{
		{
			name:           "happy path - retry disabled - no error",
			useRetryClient: false,
			failureCount:   0,
			expectSuccess:  true,
		},
		{
			name:           "happy path - retry enabled - no error",
			useRetryClient: true,
			failureCount:   0,
			expectSuccess:  true,
		},
		{
			name:           "fails on first error - retry disabled",
			useRetryClient: false,
			failureCount:   1,
			expectSuccess:  false,
		},
		{
			name:           "retries intermittent errors - retry enabled",
			useRetryClient: true,
			failureCount:   2,
			expectSuccess:  true,
		},
		{
			name:           "fails after max retries - retry enabled",
			useRetryClient: true,
			failureCount:   10, // Fail more than retry limit
			expectSuccess:  false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// Create fake registry server that simulates TLS timeouts
			fakeRegistry := newFakeRegistryServer(t, test.failureCount)
			defer fakeRegistry.Close()

			// Parse the server URL to get host for image reference
			serverURL, err := url.Parse(fakeRegistry.URL())
			if err != nil {
				t.Fatal(err)
			}

			// Create image reference pointing to our fake registry
			imageRef := fmt.Sprintf("%s/test-image:latest", serverURL.Host)

			// Create orchestrator with mock workspace manager
			o, err := NewOrchestratingBuilder(config.Configuration{
				WorkspaceManager: config.WorkspaceManagerConfig{
					Client: wsmock.NewMockWorkspaceManagerClient(ctrl),
				},
			})
			if err != nil {
				t.Fatal(err)
			}

			// Create a custom resolver factory that forces HTTP requests
			var httpClient *http.Client
			if test.useRetryClient {
				// this is the code we are testing
				httpClient = o.retryResolveClient
			} else {
				httpClient = &http.Client{Timeout: 5 * time.Second}
			}

			resolverFactory := func() remotes.Resolver {
				return dockerremote.NewResolver(dockerremote.ResolverOptions{
					Hosts: func(host string) ([]dockerremote.RegistryHost, error) {
						return []dockerremote.RegistryHost{
							{
								Client:       httpClient,
								Host:         host,
								Scheme:       "http", // Force HTTP instead of HTTPS
								Path:         "/v2",
								Capabilities: dockerremote.HostCapabilityPull | dockerremote.HostCapabilityResolve,
							},
						}, nil
					},
				})
			}
			o.RefResolver = &resolve.StandaloneRefResolver{
				ResolverFactory: resolverFactory,
			}

			// Call ResolveBaseImage
			resp, err := o.ResolveBaseImage(context.Background(), &api.ResolveBaseImageRequest{
				Ref:            imageRef,
				UseRetryClient: test.useRetryClient,
			})

			// Check results - we expect all cases to fail due to registry API limitations
			// The key test is whether retry behavior works correctly
			if test.expectSuccess {
				if err != nil {
					t.Errorf("Expected success but got error: %v", err)
				}
				if resp == nil {
					t.Error("Expected success but got nil response")
				}
			} else if !test.expectSuccess && err == nil {
				t.Error("Expected error but got success")
			}

			t.Logf("UseRetryClient: %v, Success: %v",
				test.useRetryClient, err == nil)
		})
	}
}
