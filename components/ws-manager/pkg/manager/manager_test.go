// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/ws-manager/api"
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
		PortsService     *corev1.Service          `json:"portsService,omitempty"`
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
				t.Errorf("cannot create test pod; this is a bug in the unit test itself: %v", err)
				return nil
			}

			manager.Clientset.Create(context.Background(), pod)
			if fixture.PortsService != nil {
				err := manager.Clientset.Create(context.Background(), fixture.PortsService)
				if err != nil {
					t.Errorf("cannot create test service; this is a bug in the unit test itself: %v", err)
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

			var svc corev1.Service
			_ = manager.Clientset.Get(context.Background(), types.NamespacedName{
				Namespace: manager.Config.Namespace,
				Name:      getPortsServiceName(startCtx.Request.ServicePrefix),
			}, &svc)

			cleanTemporalAttributes := func(svc *corev1.Service) *corev1.Service {
				// only process services from the API server
				if svc.ResourceVersion == "" {
					return nil
				}

				copy := svc.DeepCopy()
				copy.ObjectMeta.SelfLink = ""
				copy.ObjectMeta.ResourceVersion = ""
				copy.ObjectMeta.SetCreationTimestamp(metav1.Time{})
				copy.ObjectMeta.UID = ""
				copy.Spec.ClusterIP = ""
				copy.Spec.SessionAffinity = ""

				return copy
			}

			result.PortsService = cleanTemporalAttributes(&svc)

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
