// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"google.golang.org/grpc"

	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
	wsmock "github.com/gitpod-io/gitpod/ws-manager/api/mock"
)

func TestRemoteInfoProvider(t *testing.T) {
	type Expectation struct {
		WorkspaceInfo *WorkspaceInfo
	}
	type Step struct {
		Update      *wsapi.SubscribeResponse
		Action      func(*testing.T, WorkspaceInfoProvider) *Expectation
		Expectation *Expectation
		Parallel    bool
		DelayUpdate time.Duration
	}
	tests := []struct {
		Name  string
		Steps []Step
	}{
		{
			Name: "direct get",
			Steps: []Step{
				{
					Update: &wsapi.SubscribeResponse{
						Payload: &wsapi.SubscribeResponse_Status{Status: testWorkspaceStatus},
					},
				},
				{
					Action: func(t *testing.T, prov WorkspaceInfoProvider) *Expectation {
						ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
						nfo := prov.WorkspaceInfo(ctx, testWorkspaceStatus.Metadata.MetaId)
						cancel()

						return &Expectation{
							WorkspaceInfo: nfo,
						}
					},
					Expectation: &Expectation{
						WorkspaceInfo: testWorkspaceInfo,
					},
				},
			},
		},
		{
			Name: "wait for it",
			Steps: []Step{
				{
					Parallel: true,
					Action: func(t *testing.T, prov WorkspaceInfoProvider) *Expectation {
						ctx, cancel := context.WithTimeout(context.Background(), 1000*time.Millisecond)
						nfo := prov.WorkspaceInfo(ctx, testWorkspaceStatus.Metadata.MetaId)
						cancel()

						return &Expectation{
							WorkspaceInfo: nfo,
						}
					},
					Expectation: &Expectation{
						WorkspaceInfo: testWorkspaceInfo,
					},
				},
				{
					Parallel:    true,
					DelayUpdate: 10 * time.Millisecond,
					Update: &wsapi.SubscribeResponse{
						Payload: &wsapi.SubscribeResponse_Status{Status: testWorkspaceStatus},
					},
				},
			},
		},
		{
			Name: "not waiting for it",
			Steps: []Step{
				{
					Parallel: true,
					Action: func(t *testing.T, prov WorkspaceInfoProvider) *Expectation {
						ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
						nfo := prov.WorkspaceInfo(ctx, testWorkspaceStatus.Metadata.MetaId)
						cancel()

						return &Expectation{
							WorkspaceInfo: nfo,
						}
					},
					Expectation: &Expectation{},
				},
				{
					Parallel:    true,
					DelayUpdate: 10 * time.Millisecond,
					Update: &wsapi.SubscribeResponse{
						Payload: &wsapi.SubscribeResponse_Status{Status: testWorkspaceStatus},
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			clients := make(chan wsapi.WorkspaceManagerClient, 1)
			defer close(clients)

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			updates := make(chan *wsapi.SubscribeResponse)
			srv := wsmock.NewMockWorkspaceManager_SubscribeClient(ctrl)
			srv.EXPECT().Recv().DoAndReturn(func() (*wsapi.SubscribeResponse, error) {
				u := <-updates
				if u == nil {
					return nil, io.EOF
				}

				return u, nil
			}).AnyTimes()
			cl := wsmock.NewMockWorkspaceManagerClient(ctrl)
			cl.EXPECT().Subscribe(gomock.Any(), gomock.Any()).Return(srv, nil).AnyTimes()
			cl.EXPECT().GetWorkspaces(gomock.Any(), gomock.Any()).Return(&wsapi.GetWorkspacesResponse{}, nil).AnyTimes()

			prov := NewRemoteWorkspaceInfoProvider(WorkspaceInfoProviderConfig{WsManagerAddr: "target"})
			prov.Dialer = func(target string, dialOptions grpc.DialOption) (io.Closer, wsapi.WorkspaceManagerClient, error) {
				return io.NopCloser(nil), cl, nil
			}
			err := prov.Run()
			if err != nil {
				t.Fatal(err)
			}
			defer prov.Close()

			for i, step := range test.Steps {
				// copy step because we capture the loop variable in the Run() function
				step := step

				t.Run(fmt.Sprintf("%03d", i), func(t *testing.T) {
					if step.Parallel {
						t.Parallel()
					}
					if step.Update != nil {
						if step.DelayUpdate > 0 {
							time.Sleep(step.DelayUpdate)
						}

						updates <- step.Update
						// Give the update some time to propagate.
						// This is not the most elegant way of doing that, but in > 10k tests it didn't fail once.
						time.Sleep(1 * time.Millisecond)
					}

					if step.Action != nil {
						act := step.Action(t, prov)
						if diff := cmp.Diff(step.Expectation, act, cmpopts.IgnoreUnexported(wsapi.PortSpec{}, wsapi.WorkspaceAuthentication{})); diff != "" {
							t.Errorf("Expectation mismatch (-want +got):\n%s", diff)
						}
					}
				})
			}
		})
	}

}

var (
	testWorkspaceStatus = &wsapi.WorkspaceStatus{
		Id: "e63cb5ff-f4e4-4065-8554-b431a32c0000",
		Metadata: &wsapi.WorkspaceMetadata{
			MetaId: "e63cb5ff-f4e4-4065-8554-b431a32c2714",
		},
		Auth: &wsapi.WorkspaceAuthentication{
			Admission:  wsapi.AdmissionLevel_ADMIT_OWNER_ONLY,
			OwnerToken: "testWorkspaceOwnerToken",
		},
		Phase: wsapi.WorkspacePhase_RUNNING,
		Spec: &wsapi.WorkspaceSpec{
			IdeImage: "testWorkspaceIDEImage",
			Headless: false,
			Type:     wsapi.WorkspaceType_REGULAR,
			Url:      "https://e63cb5ff-f4e4-4065-8554-b431a32c2714.ws-eu02.gitpod.io",
			ExposedPorts: []*wsapi.PortSpec{
				{
					Port:       8080,
					Target:     38080,
					Url:        "https://8080-e63cb5ff-f4e4-4065-8554-b431a32c2714.ws-eu02.gitpod.io/",
					Visibility: wsapi.PortVisibility_PORT_VISIBILITY_PUBLIC,
				},
			},
		},
	}
	testWorkspaceInfo = &WorkspaceInfo{
		IDEImage:      testWorkspaceStatus.Spec.IdeImage,
		Auth:          testWorkspaceStatus.Auth,
		IDEPublicPort: "443",
		InstanceID:    testWorkspaceStatus.Id,
		Ports: []PortInfo{
			{
				PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
				PublicPort: "443",
			},
		},
		URL:         testWorkspaceStatus.Spec.Url,
		WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
	}
)
