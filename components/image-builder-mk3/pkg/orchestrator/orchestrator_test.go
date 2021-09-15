// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrator

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/image-builder/api"
	apimock "github.com/gitpod-io/gitpod/image-builder/api/mock"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	wsmock "github.com/gitpod-io/gitpod/ws-manager/api/mock"
	"github.com/golang/mock/gomock"
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

			o, err := NewOrchestratingBuilder(Configuration{
				WorkspaceManager: WorkspaceManagerConfig{
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
