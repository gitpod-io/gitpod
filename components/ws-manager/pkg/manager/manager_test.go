// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"testing"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	fakek8s "k8s.io/client-go/kubernetes/fake"
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
		NoAllocator  bool                   `json:"noAllocator"`
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
			if fixture.NoAllocator {
				manager.ingressPortAllocator = &noopIngressPortAllocator{}
			} else {
				manager.Config.WorkspacePortURLTemplate = "{{ .Host }}:{{ .IngressPort }}"
			}

			manager.Config.Namespace = "default"
			startCtx, err := forTestingOnlyCreateStartWorkspaceContext(manager, fixture.Request.Id, api.WorkspaceType_REGULAR)
			if err != nil {
				t.Errorf("cannot create test pod start context; this is a bug in the unit test itself: %v", err)
				return nil
			}
			pod, err := manager.createDefiniteWorkspacePod(startCtx)
			pod.Namespace = manager.Config.Namespace
			if err != nil {
				t.Errorf("cannot create test pod; this is a bug in the unit test itself: %v", err)
				return nil
			}
			state := []runtime.Object{pod}
			if fixture.PortsService != nil {
				state = append(state, fixture.PortsService)
			}

			var result gold
			manager.Clientset = fakek8s.NewSimpleClientset(state...)
			manager.OnChange = func(ctx context.Context, status *api.WorkspaceStatus) {
				result.PostChangeStatus = status.Spec.ExposedPorts
			}
			resp, err := manager.ControlPort(context.Background(), &fixture.Request)
			if err != nil {
				result.Error = err.Error()
				return &result
			}

			ctx, cancel := context.WithTimeout(context.Background(), kubernetesOperationTimeout)
			defer cancel()

			result.Response = resp
			result.PortsService, _ = manager.Clientset.CoreV1().Services(manager.Config.Namespace).Get(ctx, getPortsServiceName(startCtx.Request.ServicePrefix), metav1.GetOptions{})

			return &result
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}

func TestGetWorkspaces(t *testing.T) {
	type fixture struct {
		Pods []*corev1.Pod       `json:"pods"`
		PLIS []*corev1.ConfigMap `json:"plis"`
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

			var obj []runtime.Object
			for _, o := range fixture.Pods {
				obj = append(obj, o)
			}
			for _, o := range fixture.PLIS {
				obj = append(obj, o)
			}

			manager := forTestingOnlyGetManager(t, obj...)
			resp, err := manager.GetWorkspaces(context.Background(), &api.GetWorkspacesRequest{})

			var result gold
			result.Error = err
			if resp != nil {
				result.Status = resp.Status
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
			var objs []runtime.Object
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
			manager.Clientset = fakek8s.NewSimpleClientset(objs...)

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
