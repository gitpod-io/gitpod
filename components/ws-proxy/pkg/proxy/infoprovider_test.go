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

	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
	wsmock "github.com/gitpod-io/gitpod/ws-manager/api/mock"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
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
						Status: testWorkspaceStatus,
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
						Status: testWorkspaceStatus,
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
						Status: testWorkspaceStatus,
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
							t.Errorf("%s Expectation mismatch (-want +got):\n%s", t.Name(), diff)
						}
					}
				})
			}
		})
	}

}

func Test_workspaceInfoCache_Insert(t *testing.T) {
	type existing struct {
		infos              instanceInfosByWorkspace
		coordsByPublicPort map[string]*WorkspaceCoords
	}
	type args struct {
		newInfo *WorkspaceInfo
	}
	type expected struct {
		info               *WorkspaceInfo
		coordsByPublicPort map[string]*WorkspaceCoords
	}
	tests := []struct {
		name     string
		existing existing
		args     args
		expected expected
	}{
		{
			name:     "from scratch",
			existing: existing{},
			args: args{
				newInfo: &WorkspaceInfo{
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
					Phase:       wsapi.WorkspacePhase_UNKNOWN,
					StartedAt:   startedNow,
				},
			},
			expected: expected{
				info: &WorkspaceInfo{
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
					Phase:       wsapi.WorkspacePhase_UNKNOWN,
					StartedAt:   startedNow,
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "new instance for same workspace should prefer running",
			existing: existing{
				infos: map[string]workspaceInfosByInstance{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_UNKNOWN,
					StartedAt:   startedLater,
				},
			},
			expected: expected{
				info: testWorkspaceInfo,
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "initializing instance for same workspace should prefer running",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_INITIALIZING,
					StartedAt:   startedLater,
				},
			},
			expected: expected{
				info: testWorkspaceInfo,
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "stopping instance for workspace should be active",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: same ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0000",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_STOPPING,
					StartedAt:   startedLater,
				},
			},
			expected: expected{
				info: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: same ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0000",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_STOPPING,
					StartedAt:   startedLater,
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "update existing instance for same workspace with 2 instances same ports",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
						"e63cb5ff-f4e4-4065-8554-b431a32c0001": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_UNKNOWN,
							StartedAt:   startedLater,
						},
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_RUNNING,
					StartedAt:   startedLater,
				},
			},
			expected: expected{
				info: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_RUNNING,
					StartedAt:   startedLater,
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "update existing instance for same workspace with 2 instances different ports",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
						"e63cb5ff-f4e4-4065-8554-b431a32c0001": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_UNKNOWN,
							StartedAt:   startedLater,
						},
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "444",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "444",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_RUNNING,
					StartedAt:   startedLater,
				},
			},
			expected: expected{
				info: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "444",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "444",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_RUNNING,
					StartedAt:   startedLater,
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
					"444": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "running instance for same workspace takes precedence",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
						"e63cb5ff-f4e4-4065-8554-b431a32c0001": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_INITIALIZING,
							StartedAt:   startedNow,
						},
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: testWorkspaceInfo,
			},
			expected: expected{
				info: testWorkspaceInfo,
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "running instance for same workspace takes precedence over stopping/stopped",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						"e63cb5ff-f4e4-4065-8554-b431a32c0001": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_STOPPING,
							StartedAt:   startedNow,
						},
						"e63cb5ff-f4e4-4065-8554-b431a32c0002": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0002",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_STOPPED,
							StartedAt:   startedNow,
						},
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0003",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_RUNNING,
					StartedAt:   startedLater,
				},
			},
			expected: expected{
				info: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0003",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_RUNNING,
					StartedAt:   startedLater,
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "interrupted instance for same workspace takes precedence over stopping/stopped",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						"e63cb5ff-f4e4-4065-8554-b431a32c0001": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_STOPPING,
							StartedAt:   startedNow,
						},
						"e63cb5ff-f4e4-4065-8554-b431a32c0002": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0002",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_STOPPED,
							StartedAt:   startedNow,
						},
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				newInfo: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0003",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_INTERRUPTED,
					StartedAt:   startedLater,
				},
			},
			expected: expected{
				info: &WorkspaceInfo{
					IDEImage:      testWorkspaceStatus.Spec.IdeImage,
					Auth:          testWorkspaceStatus.Auth,
					IDEPublicPort: "443",
					// NOTE: different ID
					InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0003",
					Ports: []PortInfo{
						{
							PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
							PublicPort: "443",
						},
					},
					URL:         testWorkspaceStatus.Spec.Url,
					WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
					Phase:       wsapi.WorkspacePhase_INTERRUPTED,
					StartedAt:   startedLater,
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			act := newWorkspaceInfoCache()
			if tt.existing.infos != nil {
				act.infos = tt.existing.infos
			}
			if tt.existing.coordsByPublicPort != nil {
				act.coordsByPublicPort = tt.existing.coordsByPublicPort
			}
			act.Insert(tt.args.newInfo)
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			defer cancel()
			info, present := act.WaitFor(ctx, tt.args.newInfo.WorkspaceID)
			if tt.expected.info != nil && !present {
				t.Errorf("%s expected info result but not present:\n", t.Name())
			}
			if tt.expected.info == nil && present {
				t.Errorf("%s expected no info result but %v was present:\n", t.Name(), info)
			}
			if diff := cmp.Diff(tt.expected.info, info, cmpopts.IgnoreUnexported(wsapi.PortSpec{}, wsapi.WorkspaceAuthentication{})); diff != "" {
				t.Errorf("%s Infos expectation mismatch (-want +got):\n%s", t.Name(), diff)
			}
			for port, expCoords := range tt.expected.coordsByPublicPort {
				coords, present := act.GetCoordsByPublicPort(port)
				if !present {
					t.Errorf("%s expected coords result but not present:\n", t.Name())
				}
				if diff := cmp.Diff(expCoords, coords, cmpopts.IgnoreUnexported(wsapi.PortSpec{}, wsapi.WorkspaceAuthentication{})); diff != "" {
					t.Errorf("%s coords expectation mismatch (-want +got):\n%s", t.Name(), diff)
				}
			}
		})
	}
}

func Test_workspaceInfoCache_Delete(t *testing.T) {
	type existing struct {
		infos              instanceInfosByWorkspace
		coordsByPublicPort map[string]*WorkspaceCoords
	}
	type args struct {
		workspaceID string
		instanceID  string
	}
	type expected struct {
		info               *WorkspaceInfo
		coordsByPublicPort map[string]*WorkspaceCoords
	}
	tests := []struct {
		name     string
		existing existing
		args     args
		expected expected
	}{
		{
			name: "deletes existing",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				workspaceID: testWorkspaceInfo.WorkspaceID,
				instanceID:  testWorkspaceInfo.InstanceID,
			},
		},

		{
			name: "ignores delete of non-existing",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				workspaceID: testWorkspaceInfo.WorkspaceID,
				instanceID:  "non-existing",
			},
			expected: expected{
				info: testWorkspaceInfo,
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},

		{
			name: "only deletes specific instance",
			existing: existing{
				infos: instanceInfosByWorkspace{
					testWorkspaceInfo.WorkspaceID: {
						testWorkspaceInfo.InstanceID: testWorkspaceInfo,
						"e63cb5ff-f4e4-4065-8554-b431a32c0001": &WorkspaceInfo{
							IDEImage:      testWorkspaceStatus.Spec.IdeImage,
							Auth:          testWorkspaceStatus.Auth,
							IDEPublicPort: "443",
							// NOTE: different ID
							InstanceID: "e63cb5ff-f4e4-4065-8554-b431a32c0001",
							Ports: []PortInfo{
								{
									PortSpec:   *testWorkspaceStatus.Spec.ExposedPorts[0],
									PublicPort: "443",
								},
							},
							URL:         testWorkspaceStatus.Spec.Url,
							WorkspaceID: testWorkspaceStatus.Metadata.MetaId,
							Phase:       wsapi.WorkspacePhase_UNKNOWN,
							StartedAt:   startedNow,
						},
					},
				},
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
			args: args{
				workspaceID: testWorkspaceInfo.WorkspaceID,
				instanceID:  "e63cb5ff-f4e4-4065-8554-b431a32c0001",
			},
			expected: expected{
				info: testWorkspaceInfo,
				coordsByPublicPort: map[string]*WorkspaceCoords{
					"443": {
						ID:   testWorkspaceStatus.Metadata.MetaId,
						Port: "8080",
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			act := newWorkspaceInfoCache()
			if tt.existing.infos != nil {
				act.infos = tt.existing.infos
			}
			if tt.existing.coordsByPublicPort != nil {
				act.coordsByPublicPort = tt.existing.coordsByPublicPort
			}
			act.Delete(tt.args.workspaceID, tt.args.instanceID)
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			defer cancel()
			info, present := act.WaitFor(ctx, tt.args.workspaceID)
			if tt.expected.info != nil && !present {
				t.Errorf("%s expected info result but not present:\n", t.Name())
			}
			if tt.expected.info == nil && present {
				t.Errorf("%s expected no info result but %v was present:\n", t.Name(), info)
			}
			if diff := cmp.Diff(tt.expected.info, info, cmpopts.IgnoreUnexported(wsapi.PortSpec{}, wsapi.WorkspaceAuthentication{})); diff != "" {
				t.Errorf("%s Infos expectation mismatch (-want +got):\n%s", t.Name(), diff)
			}
			// We have to look inside the black box for this
			if tt.expected.coordsByPublicPort == nil && len(act.coordsByPublicPort) != 0 {
				t.Errorf("%s coords should be empty got%#v\n", t.Name(), act.coordsByPublicPort)
			}
			for port, expCoords := range tt.expected.coordsByPublicPort {
				coords, present := act.GetCoordsByPublicPort(port)
				if !present {
					t.Errorf("%s expected coords result but not present:\n", t.Name())
				}
				if diff := cmp.Diff(expCoords, coords, cmpopts.IgnoreUnexported(wsapi.PortSpec{}, wsapi.WorkspaceAuthentication{})); diff != "" {
					t.Errorf("%s coords expectation mismatch (-want +got):\n%s", t.Name(), diff)
				}
			}
		})
	}
}

var (
	startedNow          = time.Now()
	startedLater        = startedNow.Add(1 * time.Second)
	testWorkspaceStatus = &wsapi.WorkspaceStatus{
		Id: "e63cb5ff-f4e4-4065-8554-b431a32c0000",
		Metadata: &wsapi.WorkspaceMetadata{
			MetaId:    "e63cb5ff-f4e4-4065-8554-b431a32c2714",
			StartedAt: timestamppb.New(startedNow),
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
		Phase:       wsapi.WorkspacePhase_RUNNING,
		StartedAt:   startedNow,
	}
)
