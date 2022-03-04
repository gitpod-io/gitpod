// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"strings"
	"testing"
	"time"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/grpcpool"
	"google.golang.org/grpc"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestValidateStartWorkspaceRequest(t *testing.T) {
	type fixture struct {
		Req *api.StartWorkspaceRequest `json:"request"`
	}
	type gold struct {
		Error string `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:       t,
		Path:    "testdata/validateStartReq_*.json",
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)
			if fixture.Req == nil {
				t.Errorf("request is nil")
				return nil
			}

			err := validateStartWorkspaceRequest(fixture.Req)
			if err != nil {
				return &gold{Error: err.Error()}
			}

			return &gold{}
		},
	}
	test.Run()
}

func TestControlPort(t *testing.T) {
	type fixture struct {
		PortsService *corev1.Service        `json:"portsService,omitempty"`
		Request      api.ControlPortRequest `json:"request"`
	}
	type gold struct {
		Error            string                   `json:"error,omitempty"`
		Response         *api.ControlPortResponse `json:"response,omitempty"`
		PostChangeStatus []*api.PortSpec          `json:"postChangeStatus,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/controlPort_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			manager := forTestingOnlyGetManager(t)

			startCtx, err := forTestingOnlyCreateStartWorkspaceContext(manager, fixture.Request.Id, api.WorkspaceType_REGULAR)
			if err != nil {
				t.Errorf("cannot create test pod start context; this is a bug in the unit test itself: %v", err)
				return nil
			}

			pod, err := manager.createDefiniteWorkspacePod(startCtx)
			if err != nil {
				t.Fatalf("cannot create test pod; this is a bug in the unit test itself: %v", err)
				return nil
			}

			manager.Clientset.Create(context.Background(), pod)
			if fixture.PortsService != nil {
				err := manager.Clientset.Create(context.Background(), fixture.PortsService)
				if err != nil {
					t.Fatalf("cannot create test service; this is a bug in the unit test itself: %v", err)
					return nil
				}
			}

			var result gold
			manager.OnChange = func(ctx context.Context, status *api.WorkspaceStatus) {
				result.PostChangeStatus = status.Spec.ExposedPorts
			}

			resp, err := manager.ControlPort(context.Background(), &fixture.Request)
			if err != nil {
				result.Error = err.Error()
				return &result
			}

			result.Response = resp

			// wait for informer sync of any change introduced by ControlPort
			time.Sleep(500 * time.Millisecond)

			return &result
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}

func TestGetWorkspaces(t *testing.T) {
	t.Skipf("skipping flaky getWorkspaces_podOnly test")

	type fixture struct {
		Pods []*corev1.Pod `json:"pods"`
	}
	type gold struct {
		Status []*api.WorkspaceStatus `json:"result"`
		Error  error                  `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/getWorkspaces_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			manager := forTestingOnlyGetManager(t)

			for _, o := range fixture.Pods {
				err := manager.Clientset.Create(context.Background(), o)
				if err != nil {
					t.Errorf("cannot create test pod start context; this is a bug in the unit test itself: %v", err)
					return nil
				}
			}

			time.Sleep(1 * time.Second)

			cleanTemporalAttributes := func(workspaceStatus []*api.WorkspaceStatus) []*api.WorkspaceStatus {
				if workspaceStatus == nil {
					return nil
				}

				newStatus := []*api.WorkspaceStatus{}
				for _, status := range workspaceStatus {
					// skip status of pending pods
					if status.Message == "pod is pending" {
						continue
					}

					status.Metadata.StartedAt = nil
					newStatus = append(newStatus, status)
				}

				return newStatus
			}

			var result gold
			resp, err := manager.GetWorkspaces(context.Background(), &api.GetWorkspacesRequest{})
			result.Error = err
			if resp != nil {
				result.Status = cleanTemporalAttributes(resp.Status)
			}

			return &result
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}

func TestFindWorkspacePod(t *testing.T) {
	type tpd struct {
		WorkspaceID string
		Type        api.WorkspaceType
	}
	tests := []struct {
		Description     string
		State           []tpd
		WorkspaceID     string
		ExpectedPodName string
		ExpectedErr     string
	}{
		{
			"single prebuild",
			[]tpd{
				{"foobar", api.WorkspaceType_PREBUILD},
			},
			"foobar",
			"prebuild-foobar",
			"",
		},
		{
			"single workspace",
			[]tpd{
				{"foobar", api.WorkspaceType_REGULAR},
			},
			"foobar",
			"ws-foobar",
			"",
		},
		{
			"duplicate prebuild",
			[]tpd{
				{"foobar", api.WorkspaceType_PREBUILD},
				{"foobar", api.WorkspaceType_REGULAR},
			},
			"foobar",
			"",
			"found 2 candidates for workspace foobar",
		},
	}

	for _, test := range tests {
		t.Run(test.Description, func(t *testing.T) {
			var objs []client.Object
			manager := forTestingOnlyGetManager(t)
			for _, pd := range test.State {
				startCtx, err := forTestingOnlyCreateStartWorkspaceContext(manager, pd.WorkspaceID, pd.Type)
				if err != nil {
					t.Errorf("cannot create test pod start context; this is a bug in the unit test itself: %v", err)
					return
				}

				pod, err := manager.createDefiniteWorkspacePod(startCtx)
				if err != nil {
					t.Errorf("cannot create test pod; this is a bug in the unit test itself: %v", err)
					return
				}

				pod.Namespace = manager.Config.Namespace
				objs = append(objs, pod)
			}

			for _, obj := range objs {
				manager.Clientset.Create(context.Background(), obj)
			}

			p, err := manager.findWorkspacePod(context.Background(), test.WorkspaceID)

			var errmsg string
			if err != nil {
				errmsg = err.Error()
			}
			if test.ExpectedErr != errmsg {
				t.Errorf("unexpected error: \"%s\", expected: \"%s\"", errmsg, test.ExpectedErr)
			}

			var podname string
			if p != nil {
				podname = p.Name
			}
			if test.ExpectedPodName != podname {
				t.Errorf("unepxected findWorkspacePod result: \"%s\", expected: \"%s\"", podname, test.ExpectedPodName)
			}
		})
	}
}

func TestConnectToWorkspaceDaemon(t *testing.T) {
	badNodeName := "not-matching-node"
	goodNodeName := "a-matching-node"

	type Args struct {
		Ctx  context.Context
		WSO  workspaceObjects
		Objs []client.Object
	}
	tests := []struct {
		Name        string
		Args        Args
		WantErr     bool
		ExpectedErr string
	}{
		{
			Name: "handles empty wso",
			Args: Args{
				Ctx: context.Background(),
				WSO: workspaceObjects{},
			},
			ExpectedErr: "no nodeName found",
		},
		{
			Name: "handles no endpoints",
			Args: Args{
				Ctx: context.Background(),
				WSO: workspaceObjects{
					Pod: &corev1.Pod{
						Spec: corev1.PodSpec{
							NodeName: "a_node_name",
						},
					},
				},
			},
			ExpectedErr: "no running ws-daemon pod found",
		},
		{
			Name: "handles no endpoint on current node",
			Args: Args{
				Ctx: context.Background(),
				WSO: workspaceObjects{
					Pod: &corev1.Pod{
						Spec: corev1.PodSpec{
							NodeName: "a_node_name",
						},
					},
				},
				Objs: []client.Object{
					&corev1.Pod{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "ws-daemon",
							Namespace: "default",
							Labels: labels.Set{
								"component": "ws-daemon",
								"app":       "gitpod",
							},
						},
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{
								{
									Name:  "workspace",
									Image: "dummy",
								},
							},
							NodeName: badNodeName,
						},
						Status: corev1.PodStatus{
							Phase: corev1.PodRunning,
							PodIP: "10.1.2.3",
						},
					},
				},
			},
			ExpectedErr: "no running ws-daemon pod found",
		},
		{
			Name: "finds endpoint on current node",
			Args: Args{
				Ctx: context.Background(),
				WSO: workspaceObjects{
					Pod: &corev1.Pod{
						Spec: corev1.PodSpec{
							NodeName: goodNodeName,
						},
					},
				},
				Objs: []client.Object{
					&corev1.Pod{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "ws-daemon-endpoints",
							Namespace: "default",
							Labels: labels.Set{
								"component": "ws-daemon",
								"app":       "gitpod",
							},
						},
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{
								{
									Name:  "workspace",
									Image: "dummy",
								},
							},
							NodeName: goodNodeName,
						},
						Status: corev1.PodStatus{
							Phase: corev1.PodRunning,
							PodIP: "10.1.2.3",
						},
					},
				},
			},
		},
	}
	for _, tt := range tests {
		manager := forTestingOnlyGetManager(t, tt.Args.Objs...)
		// Add dummy daemon pool - slightly hacky but we aren't testing the actual connectivity here
		manager.wsdaemonPool = grpcpool.New(func(host string) (*grpc.ClientConn, error) {
			return nil, nil
		}, func(checkAddress string) bool { return false })

		t.Run(tt.Name, func(t *testing.T) {
			got, err := manager.connectToWorkspaceDaemon(tt.Args.Ctx, tt.Args.WSO)
			if (err != nil) && !strings.Contains(err.Error(), tt.ExpectedErr) {
				t.Errorf("Manager.connectToWorkspaceDaemon() error = %v, wantErr %v", err, tt.WantErr)
				return
			}
			if err != nil && got != nil {
				t.Errorf("Manager.connectToWorkspaceDaemon() = %v, wanted nil", got)
			}
		})
	}
}

func TestCheckWSDaemonEntpoint(t *testing.T) {
	type Args struct {
		Objs []client.Object
	}
	tests := []struct {
		Name     string
		Input    string
		Args     Args
		Expected bool
	}{
		{
			Name:     "handles no endpoints",
			Input:    "10.1.2.3",
			Args:     Args{},
			Expected: false,
		},
		{
			Name: "handles no endpoint on current node",
			Args: Args{
				Objs: []client.Object{
					&corev1.Pod{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "ws-daemon-endpoints",
							Namespace: "default",
							Labels: labels.Set{
								"component": "ws-daemon",
								"app":       "gitpod",
							},
						},
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{
								{
									Name:  "workspace",
									Image: "dummy",
								},
							},
							NodeName: "nodeName",
						},
						Status: corev1.PodStatus{
							Phase: corev1.PodRunning,
							PodIP: "10.1.2.2",
						},
					},
				},
			},
			Expected: false,
		},
		{
			Name:  "finds endpoint on current node",
			Input: "10.1.2.3",
			Args: Args{
				Objs: []client.Object{
					&corev1.Pod{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "ws-daemon-endpoints",
							Namespace: "default",
							Labels: labels.Set{
								"component": "ws-daemon",
								"app":       "gitpod",
							},
						},
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{
								{
									Name:  "workspace",
									Image: "dummy",
								},
							},
							NodeName: "nodeName",
						},
						Status: corev1.PodStatus{
							Phase: corev1.PodRunning,
							PodIP: "10.1.2.3",
						},
					},
				},
			},
			Expected: true,
		},
	}

	for _, tt := range tests {
		clientset := fake.NewClientBuilder().WithObjects(tt.Args.Objs...).Build()

		t.Run(tt.Name, func(t *testing.T) {
			got := checkWSDaemonEndpoint("default", clientset)(tt.Input)
			if got != tt.Expected {
				t.Errorf("checkWSDaemonEndpoint = %v, wanted %v", got, tt.Expected)
			}
		})
	}
}
